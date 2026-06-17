import type { FastifyInstance } from 'fastify';
import { ResearchMode, ParamType } from '../types.js';

// 内置策略元数据（核心逻辑已迁移到 Python，API 层只提供元数据）
const BUILTIN_STRATEGIES = [
  {
    name: 'dual-ma',
    description: '双均线策略：快线上穿慢线买入，下穿卖出',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'fastPeriod', label: '快线周期', type: ParamType.Number, default: 5, min: 2, max: 200 },
      { key: 'slowPeriod', label: '慢线周期', type: ParamType.Number, default: 10, min: 5, max: 500 },
    ],
    version: '1.0.0',
  },
  {
    name: 'rsi',
    description: 'RSI 策略：RSI 低于超卖线买入，高于超买线卖出',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'period', label: 'RSI 周期', type: ParamType.Number, default: 14, min: 2, max: 100 },
      { key: 'oversold', label: '超卖线', type: ParamType.Number, default: 30, min: 0, max: 50 },
      { key: 'overbought', label: '超买线', type: ParamType.Number, default: 70, min: 50, max: 100 },
    ],
    version: '1.0.0',
  },
];

export async function strategyRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return BUILTIN_STRATEGIES.map((m) => ({
      name: m.name,
      description: m.description,
      params: m.params,
      version: m.version,
    }));
  });

  app.get<{ Params: { name: string } }>('/:name', async (req, reply) => {
    const meta = BUILTIN_STRATEGIES.find((m) => m.name === req.params.name);
    if (!meta) return reply.code(404).send({ error: 'Strategy not found' });
    return {
      name: meta.name,
      description: meta.description,
      params: meta.params,
      version: meta.version,
      modes: meta.modes,
    };
  });
}
