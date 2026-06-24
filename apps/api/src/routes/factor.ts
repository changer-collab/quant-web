import { TaskType } from '../types.js';
import type { FactorDefinition } from '../types.js';
import type { FastifyInstance } from 'fastify';

export async function factorRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const factors = await app.dataCenter.repos.factors.getAll();
    return factors;
  });

  app.post('/', async (req, reply) => {
    const definition = req.body as FactorDefinition;
    await app.dataCenter.repos.factors.save(definition);
    return reply.code(201).send(definition);
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const factor = await app.dataCenter.repos.factors.getById(req.params.id);
    if (!factor) return reply.code(404).send({ error: 'Factor not found' });
    return factor;
  });

  app.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = await app.dataCenter.repos.factors.getById(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'Factor not found' });
    const updated = { ...existing, ...(req.body as Partial<FactorDefinition>) };
    await app.dataCenter.repos.factors.save(updated);
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    await app.dataCenter.repos.factors.delete(req.params.id);
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/:id/evaluate', async (req, reply) => {
    const factor = await app.dataCenter.repos.factors.getById(req.params.id);
    if (!factor) return reply.code(404).send({ error: 'Factor not found' });
    const task = await app.taskService.submit(TaskType.FactorEval, {
      factorId: factor.id,
      symbol: (req.body as { symbol?: string })?.symbol ?? '',
    });
    return reply.code(202).send({ taskId: task.id, status: task.status });
  });

  app.post('/compute', async (req, reply) => {
    const { factorIds, symbol, timeframe } = req.body as {
      factorIds: string[];
      symbol: string;
      timeframe: string;
    };
    const task = await app.taskService.submit(TaskType.FactorCompute, {
      factorIds, symbol, timeframe,
    });
    return reply.code(202).send({ taskId: task.id, status: task.status });
  });
}
