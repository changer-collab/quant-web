import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { DataCenter } from '@quant/data-center';
import type { TaskService } from './plugins/task-service.js';
import type { StrategyConfigService } from './services/config-service.js';
import type { DiagnosticService } from './services/diagnostic-service.js';
import { strategyRoutes } from './routes/strategy.js';
import { taskRoutes, internalTaskRoutes } from './routes/task.js';
import { factorRoutes } from './routes/factor.js';
import { dataRoutes } from './routes/data.js';
import { reportRoutes } from './routes/report.js';
import { factorEvalRoutes } from './routes/factor-eval.js';
import { configRoutes } from './routes/config.js';
import { previewRoutes } from './routes/preview.js';
import { diagnosticRoutes } from './routes/diagnostics.js';

export interface AppOptions {
  dataCenter: DataCenter;
  taskService: TaskService;
  configService: StrategyConfigService;
  diagnosticService: DiagnosticService;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // 直接装饰，确保路由可访问
  app.decorate('dataCenter', options.dataCenter);
  app.decorate('taskService', options.taskService);
  app.decorate('configService', options.configService);
  app.decorate('diagnosticService', options.diagnosticService);

  // 注册路由
  await app.register(strategyRoutes, { prefix: '/api/strategies' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(internalTaskRoutes, { prefix: '/api/internal/tasks' });
  await app.register(factorRoutes, { prefix: '/api/factors' });
  await app.register(dataRoutes, { prefix: '/api/data' });
  await app.register(reportRoutes, { prefix: '/api/reports' });
  await app.register(factorEvalRoutes, { prefix: '/api/evaluations' });
  await app.register(configRoutes, { prefix: '/api/strategies' });
  await app.register(previewRoutes, { prefix: '/api/strategies' });
  await app.register(diagnosticRoutes, { prefix: '/api/diagnostics' });

  return app;
}