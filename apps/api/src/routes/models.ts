/**
 * Models 端点
 *
 * GET /api/models
 * 返回已注册模型列表（不含 path 字段，避免暴露文件系统信息）
 */
import type { FastifyInstance } from 'fastify';
import { strategySyncService } from '../services/strategy-sync.js';

export async function modelRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const models = await strategySyncService.listModels();
    return models.map((m) => ({
      id: m.id,
      algorithm: m.algorithm,
      trainedAt: m.trainedAt,
      metrics: m.metrics,
    }));
  });
}
