import type { FastifyInstance } from 'fastify';
import { strategySyncService } from '../services/strategy-sync.js';

export async function strategyRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const strategies = await strategySyncService.syncFromPython();
    return strategies.map((m) => ({
      name: m.name,
      description: m.description,
      params: m.params.map((p) => ({
        key: p.key,
        label: p.label,
        type: p.type,
        default: p.default,
        min: p.min,
        max: p.max,
        options: p.options,
        chart_relevant: p.chart_relevant ?? false,
        ui_constraints: p.ui_constraints ?? [],
      })),
      version: m.version,
      kind: m.kind,
      backtestable: m.backtestable,
      category: m.category ?? 'non_factor',
      subcategory: m.subcategory ?? null,
      workflowReady: m.category === 'transitional' || (m.subcategory !== null && m.subcategory !== undefined),
    }));
  });

  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const strategies = await strategySyncService.syncFromPython();
    const meta = strategies.find((m) => m.name === req.params.name);
    if (!meta) return reply.code(404).send({ error: 'Strategy not found' });
    return {
      name: meta.name,
      description: meta.description,
      params: meta.params.map((p) => ({
        key: p.key,
        label: p.label,
        type: p.type,
        default: p.default,
        min: p.min,
        max: p.max,
        options: p.options,
        chart_relevant: p.chart_relevant ?? false,
        ui_constraints: p.ui_constraints ?? [],
      })),
      version: meta.version,
      modes: meta.modes,
      kind: meta.kind,
      backtestable: meta.backtestable,
      category: meta.category ?? 'non_factor',
      subcategory: meta.subcategory ?? null,
      workflowReady: meta.category === 'transitional' || (meta.subcategory !== null && meta.subcategory !== undefined),
    };
  });
}
