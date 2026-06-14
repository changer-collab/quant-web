import { describe, it, expect } from 'vitest';
import type { Strategy } from '../src/strategy.js';
import { StrategyState } from '../src/types.js';
import type { StrategyMeta } from '../src/meta.js';
import type { StrategyContext } from '../src/context.js';
import { ResearchMode, TimeFrame } from '@quant/common';

function createMockContext(): StrategyContext {
  return {
    submitOrder: () => {},
    getPosition: () => undefined,
    getAllPositions: () => [],
    getAccount: () => ({ initialCash: 1_000_000, cash: 1_000_000, equity: 1_000_000, positions: new Map() }),
    log: () => {},
  };
}

describe('Strategy', () => {
  it('策略生命周期', () => {
    const meta: StrategyMeta = {
      name: 'test',
      description: '测试',
      modes: [ResearchMode.Traditional],
      params: [],
      version: '0.1.0',
    };
    let state = StrategyState.Idle;
    const strategy: Strategy = {
      meta,
      get state() { return state; },
      init() { state = StrategyState.Running; },
      onBar(bar, ctx) { ctx.log('info', `K线: ${bar.symbol}`); },
      finish() { state = StrategyState.Stopped; return { meta, orders: [], trades: [] }; },
    };
    const ctx = createMockContext();
    strategy.init(ctx);
    expect(strategy.state).toBe(StrategyState.Running);
    strategy.onBar(
      { symbol: 'CSI500', timeframe: TimeFrame.D1, timestamp: Date.now(), open: 5000, high: 5100, low: 4900, close: 5050, volume: 100000 },
      ctx,
    );
    const result = strategy.finish();
    expect(strategy.state).toBe(StrategyState.Stopped);
    expect(result.meta.name).toBe('test');
  });
});
