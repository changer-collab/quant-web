import { describe, it, expect } from 'vitest';
import { BacktestHandler } from '../src/handlers/backtest-handler.js';
import { TaskQueue } from '../src/queue.js';
import { TaskType, TaskStatus, TimeFrame } from '@quant/common';
import type { Strategy } from '@quant/strategy-runtime';
import { DualMAStrategy } from '@quant/strategies';
import type { Bar } from '@quant/common';

/** 创建 mock DataCenter，预置行情数据 */
function createMockDataCenter(bars: Bar[]) {
  async function* loadBars() {
    for (const bar of bars) yield bar;
  }
  return {
    providers: {
      reference: {} as never,
      market: { loadBars },
      fundamental: {} as never,
      event: {} as never,
      l2: {} as never,
      quality: {} as never,
    },
    repos: {} as never,
    exporter: {} as never,
    close: async () => {},
    status: () => 'ready' as const,
    isClosed: () => false,
    flush: () => {},
    healthCheck: () => ({ status: 'healthy' as const, dcStatus: 'ready' as const }),
    [Symbol.asyncDispose]: async () => {},
  };
}

function generateBars(count: number): Bar[] {
  return Array.from({ length: count }, (_, i) => ({
    symbol: 'TEST', timeframe: TimeFrame.D1,
    timestamp: 1700000000000 + i * 86400000,
    open: 100 + Math.sin(i * 0.1) * 10,
    high: 105 + Math.sin(i * 0.1) * 10,
    low: 95 + Math.sin(i * 0.1) * 10,
    close: 102 + Math.sin(i * 0.1) * 10,
    volume: 1000000,
  }));
}

describe('BacktestHandler', () => {
  it('执行回测任务', async () => {
    const bars = generateBars(100);
    const dc = createMockDataCenter(bars);

    const strategyFactory = (name: string): Strategy | undefined => {
      if (name === 'dual-ma') return new DualMAStrategy({ fastPeriod: 5, slowPeriod: 20 });
      return undefined;
    };

    const handler = new BacktestHandler(dc as never, strategyFactory);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = queue.submit(TaskType.Backtest, {
      strategyName: 'dual-ma',
      symbol: 'TEST',
      timeframe: TimeFrame.D1,
      initialCash: 1000000,
      slippage: 0.001,
    });

    await queue.processAll();
    expect(task.status).toBe(TaskStatus.Completed);
    expect(task.result).toBeDefined();
    expect(task.result!.backtestResult).toBeDefined();
  });

  it('策略未找到时报错', async () => {
    const bars = generateBars(10);
    const dc = createMockDataCenter(bars);
    const strategyFactory = (_name: string): Strategy | undefined => undefined;

    const handler = new BacktestHandler(dc as never, strategyFactory);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = queue.submit(TaskType.Backtest, {
      strategyName: 'nonexistent',
      symbol: 'TEST',
      timeframe: TimeFrame.D1,
    });

    await queue.processAll();
    expect(task.status).toBe(TaskStatus.Failed);
    expect(task.error).toContain('策略未找到');
  });

  it('无行情数据时报错', async () => {
    const dc = createMockDataCenter([]);
    const strategyFactory = (_name: string): Strategy | undefined => new DualMAStrategy({ fastPeriod: 5, slowPeriod: 20 });

    const handler = new BacktestHandler(dc as never, strategyFactory);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = queue.submit(TaskType.Backtest, {
      strategyName: 'dual-ma',
      symbol: 'EMPTY',
      timeframe: TimeFrame.D1,
    });

    await queue.processAll();
    expect(task.status).toBe(TaskStatus.Failed);
    expect(task.error).toContain('无行情数据');
  });
});
