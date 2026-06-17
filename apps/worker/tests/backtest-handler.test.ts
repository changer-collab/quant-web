import { describe, it, expect, vi } from 'vitest';
import { BacktestHandler } from '../src/handlers/backtest-handler.js';
import { TaskQueue } from '../src/queue.js';
import { TaskType, TaskStatus, TimeFrame } from '../src/types.js';
import type { PythonBridge, PythonResult } from '../src/python-bridge.js';

function createMockBridge(override?: Partial<PythonBridge>): PythonBridge {
  return {
    call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
      ok: true,
      data: {
        config: { strategyName: 'mock', initialCash: 1000000, slippage: 0 },
        trades: [],
        equityCurve: [],
        metrics: {
          totalReturn: 0.05,
          annualizedReturn: 0.12,
          sharpeRatio: 1.5,
          maxDrawdown: 0.08,
          winRate: 0.55,
          totalTrades: 10,
        },
      },
    }),
    ...override,
  } as unknown as PythonBridge;
}

describe('BacktestHandler', () => {
  it('执行回测任务', async () => {
    const bridge = createMockBridge();
    const handler = new BacktestHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = queue.submit(TaskType.Backtest, {
      strategyName: 'mock',
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

  it('Python 返回错误时报错', async () => {
    const bridge = createMockBridge({
      call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
        ok: false,
        error: { code: 'NO_DATA', message: 'No bars for TEST' },
      }),
    });
    const handler = new BacktestHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = queue.submit(TaskType.Backtest, {
      strategyName: 'mock',
      symbol: 'TEST',
      timeframe: TimeFrame.D1,
    });

    await queue.processAll();
    expect(task.status).toBe(TaskStatus.Failed);
    expect(task.error).toContain('No bars');
  });
});
