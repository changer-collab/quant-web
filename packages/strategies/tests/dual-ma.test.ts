import { describe, it, expect } from 'vitest';
import { DualMAStrategy } from '../src/dual-ma.js';
import { ResearchMode } from '@quant/common';
import { TimeFrame, OrderSide } from '@quant/common';
import { StrategyState } from '@quant/strategy-runtime';
import type { Bar, Position } from '@quant/common';
import type { StrategyContext, OrderRequest } from '@quant/strategy-runtime';

function createMockContext(): { context: StrategyContext; orders: OrderRequest[] } {
  const orders: OrderRequest[] = [];
  const positions = new Map<string, Position>();
  const context: StrategyContext = {
    submitOrder: (req) => orders.push(req),
    getPosition: (symbol) => positions.get(symbol),
    getAllPositions: () => Array.from(positions.values()),
    getAccount: () => ({
      initialCash: 1_000_000,
      cash: 1_000_000,
      equity: 1_000_000,
      positions,
    }),
    log: () => {},
  };
  return { context, orders };
}

function makeBar(close: number, timestamp: number): Bar {
  return {
    symbol: 'CSI500',
    timeframe: TimeFrame.D1,
    timestamp,
    open: close - 5,
    high: close + 10,
    low: close - 10,
    close,
    volume: 100000,
  };
}

describe('DualMAStrategy', () => {
  it('元数据正确', () => {
    const strategy = new DualMAStrategy({ fastPeriod: 5, slowPeriod: 10 });
    expect(strategy.meta.name).toBe('dual-ma');
    expect(strategy.meta.modes).toContain(ResearchMode.Traditional);
    expect(strategy.meta.params).toHaveLength(2);
  });

  it('初始状态为 Idle', () => {
    const strategy = new DualMAStrategy({ fastPeriod: 5, slowPeriod: 10 });
    expect(strategy.state).toBe(StrategyState.Idle);
  });

  it('init 后状态为 Running', () => {
    const strategy = new DualMAStrategy({ fastPeriod: 5, slowPeriod: 10 });
    const { context } = createMockContext();
    strategy.init(context);
    expect(strategy.state).toBe(StrategyState.Running);
  });

  it('金叉时买入', () => {
    const strategy = new DualMAStrategy({ fastPeriod: 3, slowPeriod: 5 });
    const { context, orders } = createMockContext();
    strategy.init(context);

    // 先下跌（慢线 > 快线），再上涨（快线 > 慢线）
    const bars = [
      makeBar(100, 1000),
      makeBar(95, 2000),
      makeBar(90, 3000),
      makeBar(85, 4000),
      makeBar(80, 5000),
      makeBar(85, 6000),  // 开始上涨
      makeBar(90, 7000),
      makeBar(95, 8000),
      makeBar(100, 9000), // 金叉点
      makeBar(105, 10000),
    ];
    for (const bar of bars) strategy.onBar(bar, context);

    // 应该有买入订单
    const buyOrders = orders.filter((o) => o.side === OrderSide.Buy);
    expect(buyOrders.length).toBeGreaterThanOrEqual(1);
  });

  it('finish 后状态为 Stopped', () => {
    const strategy = new DualMAStrategy({ fastPeriod: 5, slowPeriod: 10 });
    const { context } = createMockContext();
    strategy.init(context);
    const result = strategy.finish();
    expect(strategy.state).toBe(StrategyState.Stopped);
    expect(result.meta.name).toBe('dual-ma');
  });

  it('数据不足时不交易', () => {
    const strategy = new DualMAStrategy({ fastPeriod: 5, slowPeriod: 10 });
    const { context, orders } = createMockContext();
    strategy.init(context);

    // 只给 3 根 K 线，不够计算均线
    for (let i = 0; i < 3; i++) {
      strategy.onBar(makeBar(100 + i, i * 1000), context);
    }
    expect(orders).toHaveLength(0);
  });
});
