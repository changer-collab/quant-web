import type { FastifyInstance } from 'fastify';
import { ResearchMode, ParamType } from '../types.js';

/**
 * 内置策略元数据
 * 与 Python 注册表 packages/strategies/quantforge_strategies/__init__.py 保持一致
 * 核心逻辑已迁移到 Python，API 层只提供元数据
 */
const BUILTIN_STRATEGIES = [
  {
    name: 'dual_ma',
    description: '双均线策略：短均线上穿长均线买入，下穿卖出',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'short_period', label: '短均线周期', type: ParamType.Number, default: 5, min: 2, max: 50 },
      { key: 'long_period', label: '长均线周期', type: ParamType.Number, default: 20, min: 5, max: 200 },
    ],
    version: '0.1.0',
    kind: 'combined',
  },
  {
    name: 'rsi',
    description: 'RSI 策略：RSI 低于超卖线买入，高于超买线卖出',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'period', label: 'RSI 周期', type: ParamType.Number, default: 14, min: 2, max: 50 },
      { key: 'oversold', label: '超卖阈值', type: ParamType.Number, default: 30, min: 10, max: 50 },
      { key: 'overbought', label: '超买阈值', type: ParamType.Number, default: 70, min: 50, max: 90 },
    ],
    version: '0.1.0',
    kind: 'combined',
  },
  {
    name: 'bollinger_band',
    description: '布林带策略：价格跌破下轨买入，突破上轨卖出',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'period', label: '周期', type: ParamType.Number, default: 20, min: 5, max: 100 },
      { key: 'num_std', label: '标准差倍数', type: ParamType.Number, default: 2.0, min: 0.5, max: 4.0 },
    ],
    version: '0.1.0',
    kind: 'combined',
  },
  {
    name: 'macd',
    description: 'MACD 策略：DIF 上穿 DEA 买入，下穿卖出',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'fast_period', label: '快线周期', type: ParamType.Number, default: 12, min: 2, max: 100 },
      { key: 'slow_period', label: '慢线周期', type: ParamType.Number, default: 26, min: 5, max: 200 },
      { key: 'signal_period', label: '信号周期', type: ParamType.Number, default: 9, min: 2, max: 50 },
    ],
    version: '0.1.0',
    kind: 'combined',
  },
  {
    name: 'kdj',
    description: 'KDJ 策略：K 线在超卖区上穿 D 线买入，在超买区下穿卖出',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'period', label: 'KDJ 周期', type: ParamType.Number, default: 9, min: 2, max: 100 },
      { key: 'oversold', label: '超卖阈值', type: ParamType.Number, default: 20, min: 5, max: 40 },
      { key: 'overbought', label: '超买阈值', type: ParamType.Number, default: 80, min: 60, max: 95 },
    ],
    version: '0.1.0',
    kind: 'combined',
  },
];

export async function strategyRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return BUILTIN_STRATEGIES.map((m) => ({
      name: m.name,
      description: m.description,
      params: m.params,
      version: m.version,
      kind: m.kind,
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
      kind: meta.kind,
    };
  });
}
