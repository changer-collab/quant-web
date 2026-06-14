import { describe, it, expect } from 'vitest';
import type { StrategyMeta } from '../src/meta.js';
import { ResearchMode, ParamType } from '@quant/common';

describe('StrategyMeta', () => {
  it('定义有效的策略元数据', () => {
    const meta: StrategyMeta = {
      name: 'dual-ma',
      description: '双均线策略',
      modes: [ResearchMode.Traditional],
      params: [
        { key: 'fastPeriod', label: '快线周期', type: ParamType.Number, default: 10, min: 2, max: 200 },
        { key: 'slowPeriod', label: '慢线周期', type: ParamType.Number, default: 30, min: 5, max: 500 },
      ],
      version: '1.0.0',
    };
    expect(meta.name).toBe('dual-ma');
    expect(meta.modes).toContain(ResearchMode.Traditional);
    expect(meta.params).toHaveLength(2);
  });
});
