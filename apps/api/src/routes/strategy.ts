import type { FastifyInstance } from 'fastify';
import { strategySyncService } from '../services/strategy-sync.js';

export async function strategyRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const strategies = await strategySyncService.syncFromPython();
    return strategies.map((m) => ({
      name: m.name,
      description: m.description,
      params: m.params,
      version: m.version,
      kind: m.kind,
      backtestable: m.backtestable,
    }));
  });

  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const strategies = await strategySyncService.syncFromPython();
    const meta = strategies.find((m) => m.name === req.params.name);
    if (!meta) return reply.code(404).send({ error: 'Strategy not found' });
    return {
      name: meta.name,
      description: meta.description,
      params: meta.params,
      version: meta.version,
      modes: meta.modes,
      kind: meta.kind,
      backtestable: meta.backtestable,
    };
  });
}
