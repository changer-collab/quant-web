import { describe, it, expect } from 'vitest';
import { RSIStrategy } from '../src/rsi.js';
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

describe('RSIStrategy', () => {
  it('元数据正确', () => {
    const strategy = new RSIStrategy({ period: 14, oversold: 30, overbought: 70 });
    expect(strategy.meta.name).toBe('rsi');
    expect(strategy.meta.modes).toContain(ResearchMode.Traditional);
    expect(strategy.meta.params).toHaveLength(3);
  });

  it('初始状态为 Idle', () => {
    const strategy = new RSIStrategy();
    expect(strategy.state).toBe(StrategyState.Idle);
  });

  it('init 后状态为 Running', () => {
    const strategy = new RSIStrategy();
    const { context } = createMockContext();
    strategy.init(context);
    expect(strategy.state).toBe(StrategyState.Running);
  });

  it('超卖时买入', () => {
    const strategy = new RSIStrategy({ period: 5, oversold: 30, overbought: 70 });
    const { context, orders } = createMockContext();
    strategy.init(context);

    // 连续下跌触发超卖
    const bars: Bar[] = [];
    let price = 100;
    for (let i = 0; i < 20; i++) {
      price -= 3;
      bars.push(makeBar(price, i * 1000));
    }
    for (const bar of bars) strategy.onBar(bar, context);

    const buyOrders = orders.filter((o) => o.side === OrderSide.Buy);
    expect(buyOrders.length).toBeGreaterThanOrEqual(1);
  });

  it('finish 后状态为 Stopped', () => {
    const strategy = new RSIStrategy();
    const { context } = createMockContext();
    strategy.init(context);
    const result = strategy.finish();
    expect(strategy.state).toBe(StrategyState.Stopped);
    expect(result.meta.name).toBe('rsi');
  });

  it('数据不足时不交易', () => {
    const strategy = new RSIStrategy({ period: 14 });
    const { context, orders } = createMockContext();
    strategy.init(context);

    for (let i = 0; i < 5; i++) {
      strategy.onBar(makeBar(100 + i, i * 1000), context);
    }
    expect(orders).toHaveLength(0);
  });
});
