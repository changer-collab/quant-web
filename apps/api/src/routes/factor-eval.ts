import type { FastifyInstance } from 'fastify';
import { FactorEvaluationRepository } from '../storage/eval-repo.js';

export async function factorEvalRoutes(app: FastifyInstance) {
  const repo = new FactorEvaluationRepository();

  /** 获取因子的评估历史 */
  app.get<{ Params: { factorId: string } }>('/factor/:factorId', async (req) => {
    return repo.getByFactorId(req.params.factorId);
  });

  /** 获取因子的最新评估 */
  app.get<{ Params: { factorId: string } }>('/factor/:factorId/latest', async (req, reply) => {
    const evaluation = await repo.getLatestByFactorId(req.params.factorId);
    if (!evaluation) {
      return reply.code(404).send({ error: 'Evaluation not found' });
    }
    return evaluation;
  });

  /** 获取评估详情 */
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const evaluation = await repo.getById(req.params.id);
    if (!evaluation) {
      return reply.code(404).send({ error: 'Evaluation not found' });
    }
    return evaluation;
  });

  /** 删除评估 */
  app.delete<{ Params: { id: string } }>('/:id', async (req) => {
    await repo.delete(req.params.id);
    return { success: true };
  });
}