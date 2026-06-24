import type { FastifyInstance } from 'fastify';
import { ReportRepository } from '../storage/report-repo.js';

export async function reportRoutes(app: FastifyInstance) {
  const repo = new ReportRepository();

  /** 获取报告列表 */
  app.get('/', async (req) => {
    const { strategy, symbol, startTime, endTime, limit, offset } = req.query as {
      strategy?: string;
      symbol?: string;
      startTime?: string;
      endTime?: string;
      limit?: string;
      offset?: string;
    };

    return repo.list({
      strategyName: strategy,
      symbol,
      startTime: startTime ? Number(startTime) : undefined,
      endTime: endTime ? Number(endTime) : undefined,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
    });
  });

  /** 获取报告详情 */
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const report = await repo.getById(req.params.id);
    if (!report) {
      return reply.code(404).send({ error: 'Report not found' });
    }
    return report;
  });

  /** 删除报告 */
  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await repo.delete(req.params.id);
    return { success: true };
  });

  /** 获取报告数量 */
  app.get('/count', async (req) => {
    const { strategy, symbol } = req.query as {
      strategy?: string;
      symbol?: string;
    };

    const count = await repo.count({
      strategyName: strategy,
      symbol,
    });
    return { count };
  });
}