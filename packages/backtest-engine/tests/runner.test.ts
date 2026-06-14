import { describe, it, expect } from 'vitest';
import { BacktestRunner } from '../src/runner.js';
import { TimeFrame, ResearchMode, OrderSide, OrderType } from '@quant/common';
import type { Bar, Strategy, StrategyContext } from '@quant/common';
import type { StrategyMeta } from '@quant/strategy-runtime';
import { StrategyState } from '@quant/strategy-runtime';
import { DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE } from '@quant/common';

/** 测试用双均线策略：快线上穿慢线买入，下穿卖出 */
function createDualMAStrategy(fastPeriod: number, slowPeriod: number): Strategy {
  const closes: number[] = [];
  let ctx: StrategyContext | null = null;
  let state: StrategyState = StrategyState.Idle;
  const meta: StrategyMeta = {
    name: 'dual-ma',
    description: '双均线策略',
    modes: [ResearchMode.Traditional],
    params: [
      { key: 'fastPeriod', label: '快线周期', type: 'number' as any, default: fastPeriod },
      { key: 'slowPeriod', label: '慢线周期', type: 'number' as any, default: slowPeriod },
    ],
    version: '1.0.0',
  };

  return {
    meta,
    get state() { return state; },
    init(context: StrategyContext) {
      ctx = context;
      state = StrategyState.Running;
    },
    onBar(bar: Bar) {
      closes.push(bar.close);
      if (closes.length < slowPeriod || !ctx) return;

      const fastMA = closes.slice(-fastPeriod).reduce((s, c) => s + c, 0) / fastPeriod;
      const slowMA = closes.slice(-slowPeriod).reduce((s, c) => s + c, 0) / slowPeriod;
      const prevFast = closes.slice(-fastPeriod - 1, -1).reduce((s, c) => s + c, 0) / fastPeriod;
      const prevSlow = closes.slice(-slowPeriod - 1, -1).reduce((s, c) => s + c, 0) / slowPeriod;

      const pos = ctx.getPosition(bar.symbol);
      // 金叉买入
      if (prevFast <= prevSlow && fastMA > slowMA && !pos) {
        ctx.submitOrder({ symbol: bar.symbol, side: OrderSide.Buy, type: OrderType.Market, quantity: 100 });
      }
      // 死叉卖出
      if (prevFast >= prevSlow && fastMA < slowMA && pos) {
        ctx.submitOrder({ symbol: bar.symbol, side: OrderSide.Sell, type: OrderType.Market, quantity: pos.quantity });
      }
    },
    finish() {
      state = StrategyState.Stopped;
      return { meta, orders: [], trades: [] };
    },
  };
}

/** 生成模拟 K 线：先跌后涨，触发金叉 */
function generateBars(count: number): Bar[] {
  const bars: Bar[] = [];
  const baseTs = Date.now() - count * 86400000;
  let price = 5000;
  for (let i = 0; i < count; i++) {
    // 前 1/3 下跌，后 2/3 上涨
    const change = i < count / 3
      ? -(Math.random() * 20 + 5)
      : (Math.random() * 20 + 5);
    price += change;
    bars.push({
      symbol: 'CSI500',
      timeframe: TimeFrame.D1,
      timestamp: baseTs + i * 86400000,
      open: price - 10,
      high: price + 20,
      low: price - 20,
      close: price,
      volume: 100000,
    });
  }
  return bars;
}

describe('BacktestRunner', () => {
  it('完整回测流程', () => {
    const strategy = createDualMAStrategy(5, 10);
    const bars = generateBars(60);
    const runner = new BacktestRunner({
      strategy,
      bars,
      initialCash: DEFAULT_INITIAL_CASH,
      slippage: DEFAULT_SLIPPAGE,
    });

    const result = runner.run();

    expect(result.config.strategyName).toBe('dual-ma');
    expect(result.config.initialCash).toBe(DEFAULT_INITIAL_CASH);
    expect(result.equityCurve.length).toBeGreaterThan(0);
    expect(result.metrics).toBeDefined();
    expect(result.metrics.totalReturn).toBeDefined();
    expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
  });

  it('空行情不崩溃', () => {
    const strategy = createDualMAStrategy(5, 10);
    const runner = new BacktestRunner({
      strategy,
      bars: [],
      initialCash: DEFAULT_INITIAL_CASH,
      slippage: 0,
    });

    const result = runner.run();
    expect(result.equityCurve).toHaveLength(0);
    expect(result.metrics.totalReturn).toBe(0);
  });

  it('回测结果包含配置信息', () => {
    const strategy = createDualMAStrategy(5, 10);
    const bars = generateBars(30);
    const runner = new BacktestRunner({
      strategy,
      bars,
      initialCash: 500_000,
      slippage: 0.001,
    });

    const result = runner.run();
    expect(result.config.initialCash).toBe(500_000);
    expect(result.config.slippage).toBe(0.001);
  });
});
