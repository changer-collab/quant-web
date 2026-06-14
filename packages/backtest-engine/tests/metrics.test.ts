import { describe, it, expect } from 'vitest';
import { calculateMetrics } from '../src/metrics.js';
import type { EquityPoint } from '@quant/common';

describe('calculateMetrics', () => {
  it('空曲线返回零值', () => {
    const m = calculateMetrics([], 1_000_000);
    expect(m.totalReturn).toBe(0);
    expect(m.maxDrawdown).toBe(0);
    expect(m.sharpeRatio).toBe(0);
  });

  it('单点曲线返回零值', () => {
    const m = calculateMetrics([{ timestamp: 1000, equity: 1_000_000 }], 1_000_000);
    expect(m.totalReturn).toBe(0);
  });

  it('盈利曲线 totalReturn > 0', () => {
    const curve: EquityPoint[] = [
      { timestamp: 1000, equity: 1_000_000 },
      { timestamp: 2000, equity: 1_100_000 },
    ];
    const m = calculateMetrics(curve, 1_000_000);
    expect(m.totalReturn).toBeCloseTo(0.1, 2);
  });

  it('亏损曲线 totalReturn < 0', () => {
    const curve: EquityPoint[] = [
      { timestamp: 1000, equity: 1_000_000 },
      { timestamp: 2000, equity: 900_000 },
    ];
    const m = calculateMetrics(curve, 1_000_000);
    expect(m.totalReturn).toBeCloseTo(-0.1, 2);
  });

  it('最大回撤计算', () => {
    const curve: EquityPoint[] = [
      { timestamp: 1000, equity: 1_000_000 },
      { timestamp: 2000, equity: 1_200_000 },
      { timestamp: 3000, equity: 900_000 },
      { timestamp: 4000, equity: 1_100_000 },
    ];
    const m = calculateMetrics(curve, 1_000_000);
    expect(m.maxDrawdown).toBeCloseTo(0.25, 2); // (1200000-900000)/1200000
  });

  it('夏普比率计算', () => {
    // 生成 10 个点的上升曲线
    const curve: EquityPoint[] = Array.from({ length: 10 }, (_, i) => ({
      timestamp: (i + 1) * 1000,
      equity: 1_000_000 + (i + 1) * 10_000,
    }));
    const m = calculateMetrics(curve, 1_000_000);
    expect(m.sharpeRatio).toBeGreaterThan(0);
  });
});
