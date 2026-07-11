import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { DataCenter } from '@quant/data-center';
import type { TaskService } from './plugins/task-service.js';
import type { ReportRepository } from './storage/report-repo.js';
import type { StrategyConfigService } from './services/config-service.js';
import type { DiagnosticService } from './services/diagnostic-service.js';
import type { TaskType } from './types.js';
import type { ResultProcessor } from './services/result-processors/types.js';
import { InMemoryResearchRepository } from './research/repository.js';
import { ResearchService } from './research/service.js';
import type { ResearchRepository } from './research/repository.js';
import { strategyRoutes } from './routes/strategy.js';
import { taskRoutes, internalTaskRoutes } from './routes/task.js';
import { factorRoutes } from './routes/factor.js';
import { dataRoutes } from './routes/data.js';
import { reportRoutes } from './routes/report.js';
import { factorEvalRoutes } from './routes/factor-eval.js';
import { diagnosticRoutes } from './routes/diagnostics.js';
import { modelRoutes } from './routes/models.js';
import { internalResearchRoutes, researchRoutes } from './routes/research.js';

export interface AppOptions {
  dataCenter: DataCenter;
  taskService: TaskService;
  configService: StrategyConfigService;
  diagnosticService: DiagnosticService;
  reportRepository?: ReportRepository;
  resultProcessorRegistry?: Map<TaskType, ResultProcessor>;
  researchRepository?: ResearchRepository;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // 直接装饰，确保路由可访问
  app.decorate('dataCenter', options.dataCenter);
  app.decorate('taskService', options.taskService);
  app.decorate('configService', options.configService);
  app.decorate('diagnosticService', options.diagnosticService);
  app.decorate('reportRepository', options.reportRepository ?? null);
  app.decorate('resultProcessorRegistry', options.resultProcessorRegistry ?? new Map());
  app.decorate(
    'researchService',
    new ResearchService(options.researchRepository ?? new InMemoryResearchRepository())
  );

  // 注册路由
  await app.register(strategyRoutes, { prefix: '/api/strategies' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(internalTaskRoutes, { prefix: '/api/internal/tasks' });
  await app.register(factorRoutes, { prefix: '/api/factors' });
  await app.register(dataRoutes, { prefix: '/api/data' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(factorEvalRoutes, { prefix: '/api/evaluations' });
  await app.register(diagnosticRoutes, { prefix: '/api/diagnostics' });
  await app.register(modelRoutes, { prefix: '/api/models' });
  await app.register(researchRoutes, { prefix: '/api/research' });
  await app.register(internalResearchRoutes, { prefix: '/api/internal/research' });

  return app;
}

// Fastify 实例类型扩展
declare module 'fastify' {
  interface FastifyInstance {
    reportRepository: ReportRepository | null;
    researchService: ResearchService;
  }
}
