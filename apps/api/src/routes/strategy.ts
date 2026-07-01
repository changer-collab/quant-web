import type { FastifyInstance } from 'fastify';
import { strategySyncService } from '../services/strategy-sync.js';
import type { StrategyCategory, StrategySubcategory } from '../types.js';
import { configRoutes } from './config.js';
import { previewRoutes } from './preview.js';

/**
 * 判断策略是否"工作流就绪"：
 * category ∈ canonical 3 值集 AND subcategory ∈ canonical 10 值集 → true
 * subcategory=null → false（未分类策略视为未就绪）
 */
const CANONICAL_CATEGORIES: StrategyCategory[] = ['factor_based', 'non_factor', 'transitional'];
const CANONICAL_SUBCATEGORIES: StrategySubcategory[] = [
  'linear_multi_factor', 'index_enhancement', 'ml_nonlinear_factor',
  'trend_cta', 'arbitrage', 'hft_microstructure', 'macro_quant',
  'event_driven', 'e2e_ai_timeseries', 'event_sentiment_factor',
];

function isWorkflowReady(category: string, subcategory: string | null): boolean {
  if (subcategory === null) return false;
  return (
    CANONICAL_CATEGORIES.includes(category as StrategyCategory) &&
    CANONICAL_SUBCATEGORIES.includes(subcategory as StrategySubcategory)
  );
}

function mapMeta(m: Awaited<ReturnType<typeof strategySyncService.syncFromPython>>[number]) {
  return {
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
    workflowReady: isWorkflowReady(m.category ?? 'non_factor', m.subcategory ?? null),
  };
}

export async function strategyRoutes(app: FastifyInstance) {
  // ── 策略元信息 ──

  app.get('/', async () => {
    const strategies = await strategySyncService.syncFromPython();
    return strategies.map(mapMeta);
  });

  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const strategies = await strategySyncService.syncFromPython();
    const meta = strategies.find((m) => m.name === req.params.name);
    if (!meta) return reply.code(404).send({ error: 'Strategy not found' });
    return {
      ...mapMeta(meta),
      modes: meta.modes,
    };
  });

  // ── 策略配置 CRUD（挂载 GET/PUT /:name/config） ──
  await app.register(configRoutes);

  // ── Preview 端点（挂载 POST /:name/preview） ──
  await app.register(previewRoutes);
}
