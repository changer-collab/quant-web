/**
 * SQLite 连接管理 — sql.js 实现（纯 WASM，零编译）
 *
 * 与 services/data-center 保持一致的 sql.js 驱动方案，
 * 消除全项目对 better-sqlite3 native 模块的依赖。
 *
 * 默认路径：项目根目录 data/api.db
 * 可通过参数覆盖。
 *
 * 注意：sql.js 是内存数据库，close 时需手动 export 到文件实现持久化。
 */
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import * as schema from './schema.js';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type ApiDb = SQLJsDatabase<typeof schema>;

let db: ApiDb | null = null;
let sqlite: SqlJsDatabase | null = null;
let currentDbPath: string | null = null;

/** 获取 sql.js 包目录下的 wasm 文件路径（兼容 pnpm workspace） */
function resolveWasmPath(file: string): string {
  // 尝试从当前包 node_modules 定位
  const fromPackage = resolve(__dirname, '..', '..', '..', '..', 'node_modules', 'sql.js', 'dist', file);
  if (existsSync(fromPackage)) return fromPackage;

  // 尝试从 process.cwd() 向上逐层查找
  let dir = process.cwd();
  while (true) {
    const candidate = resolve(dir, 'node_modules', 'sql.js', 'dist', file);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // 到达根目录
    dir = parent;
  }

  // 最后尝试：从 sql.js 包自身位置定位
  try {
    const resolved = import.meta.resolve('sql.js/dist/' + file);
    if (resolved.startsWith('file://')) {
      return fileURLToPath(resolved);
    }
  } catch {
    // ignore resolve failure
  }

  // 全部失败，返回默认路径（sql.js 会抛出明确错误）
  return resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
}

export async function initApiDb(dbPath?: string): Promise<ApiDb> {
  if (db) return db;

  const resolvedPath = dbPath ?? resolve(process.cwd(), 'data', 'api.db');
  const dir = dirname(resolvedPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs({
    locateFile: (file: string) => resolveWasmPath(file),
  });

  if (existsSync(resolvedPath)) {
    const buf = readFileSync(resolvedPath);
    sqlite = new SQL.Database(buf);
  } else {
    sqlite = new SQL.Database();
  }

  currentDbPath = resolvedPath;

  // 创建表
  sqlite.run('PRAGMA journal_mode=WAL;');
  sqlite.run('PRAGMA foreign_keys=ON;');
  sqlite.run('PRAGMA busy_timeout=5000;');
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS backtest_reports (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      strategy_name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      start_time INTEGER,
      end_time INTEGER,
      created_at INTEGER NOT NULL,
      total_return REAL NOT NULL,
      annualized_return REAL NOT NULL,
      sharpe_ratio REAL NOT NULL,
      max_drawdown REAL NOT NULL,
      win_rate REAL NOT NULL,
      total_trades INTEGER NOT NULL,
      report_data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_strategy ON backtest_reports(strategy_name);
    CREATE INDEX IF NOT EXISTS idx_reports_symbol ON backtest_reports(symbol);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON backtest_reports(created_at);

    CREATE TABLE IF NOT EXISTS factor_evaluations (
      id TEXT PRIMARY KEY,
      factor_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ic_mean REAL,
      ic_std REAL,
      rank_ic_mean REAL,
      rank_ic_std REAL,
      icir REAL,
      rank_icir REAL,
      group_returns TEXT,
      eval_data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evals_factor ON factor_evaluations(factor_id);
    CREATE INDEX IF NOT EXISTS idx_evals_created ON factor_evaluations(created_at);

    CREATE TABLE IF NOT EXISTS strategy_configs (
      strategy TEXT PRIMARY KEY,
      config_json TEXT NOT NULL,
      hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS config_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      strategy TEXT NOT NULL,
      config_json TEXT NOT NULL,
      hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cfg_hist_strategy ON config_history(strategy);

    CREATE TABLE IF NOT EXISTS diagnostic_results (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      strategy TEXT NOT NULL,
      config_snapshot TEXT NOT NULL,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_diag_strategy ON diagnostic_results(strategy);
    CREATE INDEX IF NOT EXISTS idx_diag_created ON diagnostic_results(created_at);
  `);

  db = drizzle(sqlite, { schema });
  return db;
}

export function getApiDb(): ApiDb {
  if (!db) {
    throw new Error('API database not initialized. Call initApiDb() first.');
  }
  return db;
}

/**
 * 关闭数据库连接。
 * @param persist 是否将内存数据库持久化到文件（默认 true）。
 *                测试场景传 false 跳过持久化。
 */
export function closeApiDb(persist = true): void {
  if (sqlite) {
    if (persist && currentDbPath) {
      const data = sqlite.export();
      writeFileSync(currentDbPath, Buffer.from(data));
    }
    sqlite.close();
    sqlite = null;
    db = null;
    currentDbPath = null;
  }
}
