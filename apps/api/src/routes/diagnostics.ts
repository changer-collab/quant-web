/**
 * Diagnostics 路由
 *
 * GET  /api/diagnostics/:resultId  → 获取单个诊断结果
 * GET  /api/diagnostics?strategy=xxx → 列出策略的诊断历史
 */

import type { FastifyInstance } from 'fastify';

export async function diagnosticRoutes(app: FastifyInstance) {
  /** 获取单个诊断结果 */
  app.get<{ Params: { resultId: string } }>('/:resultId', async (req, reply) => {
    const result = await app.diagnosticService.getById(req.params.resultId);
    if (!result) return reply.code(404).send({ error: 'Diagnostic result not found' });
    return result;
  });

  /** 按策略名列出诊断历史 */
  app.get('/', async (req, reply) => {
    const { strategy } = req.query as { strategy?: string };
    if (!strategy) {
      return reply.code(400).send({ error: 'Query parameter "strategy" is required' });
    }
    return await app.diagnosticService.listByStrategy(strategy);
  });
}
