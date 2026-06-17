import { TaskType } from '../types.js';
import type { FactorDefinition } from '../types.js';
import type { FastifyInstance } from 'fastify';

// 内存因子注册表（后续迁移到 DataCenter）
const factorStore = new Map<string, FactorDefinition>();

export async function factorRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return Array.from(factorStore.values());
  });

  app.post('/', async (req, reply) => {
    const definition = req.body as FactorDefinition;
    factorStore.set(definition.id, definition);
    return reply.code(201).send(definition);
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const factor = factorStore.get(req.params.id);
    if (!factor) return reply.code(404).send({ error: 'Factor not found' });
    return factor;
  });

  app.put<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const existing = factorStore.get(req.params.id);
    if (!existing) return reply.code(404).send({ error: 'Factor not found' });
    const updated = { ...existing, ...(req.body as Partial<FactorDefinition>) };
    factorStore.set(req.params.id, updated);
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const deleted = factorStore.delete(req.params.id);
    if (!deleted) return reply.code(404).send({ error: 'Factor not found' });
    return reply.code(204).send();
  });

  app.post<{ Params: { id: string } }>('/:id/evaluate', async (req, reply) => {
    const factor = factorStore.get(req.params.id);
    if (!factor) return reply.code(404).send({ error: 'Factor not found' });
    const task = app.taskService.submit(TaskType.FactorEval, {
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
    const task = app.taskService.submit(TaskType.FactorCompute, {
      factorIds, symbol, timeframe,
    });
    return reply.code(202).send({ taskId: task.id, status: task.status });
  });
}
