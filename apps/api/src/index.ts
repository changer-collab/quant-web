import { buildApp } from './app.js';
import { createDataCenter } from '@quant/data-center/storage';
import { SqliteTaskService } from './plugins/sqlite-task-service.js';
import { initApiDb, closeApiDb } from './storage/connection.js';
import { ReportRepository } from './storage/report-repo.js';
import { SqliteConfigHistoryRepo, SqliteConfigRepo } from './repositories/sqlite-config-repo.js';
import { SqliteDiagnosticRepo } from './repositories/sqlite-diag-repo.js';
import { StrategyConfigService } from './services/config-service.js';
import { DiagnosticService } from './services/diagnostic-service.js';
import { createResultProcessorRegistry } from './services/result-processors/index.js';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** 从当前工作目录向上查找项目根目录（以 pnpm-workspace.yaml 为标志） */
function findProjectRoot(): string {
  let dir = process.cwd();
  while (true) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();
const dbPath = resolve(projectRoot, 'data', 'quant.db');
const dataCenter = await createDataCenter({ dbPath });

// 初始化 API 层数据库
const apiDb = await initApiDb();

// 使用 SQLite 任务服务
const taskService = new SqliteTaskService(dataCenter.repos.tasks);
await taskService.init();

// ─── 注册 Repository 与 Service（三层架构） ──────────────────────────
const configHistoryRepo = new SqliteConfigHistoryRepo(apiDb);
const configRepo = new SqliteConfigRepo(apiDb, configHistoryRepo);
const diagRepo = new SqliteDiagnosticRepo(apiDb);

const configService = new StrategyConfigService(configRepo);
const diagnosticService = new DiagnosticService(diagRepo);

// ─── ReportRepository + ResultProcessor 注册表 ───────────────────────
const reportRepo = new ReportRepository();
const resultProcessorRegistry = createResultProcessorRegistry({
  reportRepository: reportRepo,
  diagnosticService,
});

const app = await buildApp({
  dataCenter,
  taskService,
  configService,
  diagnosticService,
  reportRepository: reportRepo,
  resultProcessorRegistry,
});

// 优雅关闭
process.on('SIGINT', async () => {
  closeApiDb();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  closeApiDb();
  process.exit(0);
});

await app.listen({ port: 3002, host: '0.0.0.0' });