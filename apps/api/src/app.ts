import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import type { DataCenter } from '@quant/data-center';
import type { TaskService } from './plugins/task-service.js';
import { strategyRoutes } from './routes/strategy.js';
import { taskRoutes, internalTaskRoutes } from './routes/task.js';
import { factorRoutes } from './routes/factor.js';
import { dataRoutes } from './routes/data.js';

export interface AppOptions {
  dataCenter: DataCenter;
  taskService: TaskService;
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // 直接装饰，确保路由可访问
  app.decorate('dataCenter', options.dataCenter);
  app.decorate('taskService', options.taskService);

  // 注册路由
  await app.register(strategyRoutes, { prefix: '/api/strategies' });
  await app.register(taskRoutes, { prefix: '/api/tasks' });
  await app.register(internalTaskRoutes, { prefix: '/api/internal/tasks' });
  await app.register(factorRoutes, { prefix: '/api/factors' });
  await app.register(dataRoutes, { prefix: '/api/data' });

  return app;
}