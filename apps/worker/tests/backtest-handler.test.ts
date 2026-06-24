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

    const task = await queue.submit(TaskType.Backtest, {
      strategyName: 'mock',
      symbol: 'TEST',
      timeframe: TimeFrame.D1,
      initialCash: 1000000,
      slippage: 0.001,
    });

    await queue.processAll();
    const completed = await queue.get(task.id);
    expect(completed!.status).toBe(TaskStatus.Completed);
    expect(completed!.result).toBeDefined();
    expect(completed!.result!.backtestResult).toBeDefined();
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

    const task = await queue.submit(TaskType.Backtest, {
      strategyName: 'mock',
      symbol: 'TEST',
      timeframe: TimeFrame.D1,
    });

    await queue.processAll();
    const failed = await queue.get(task.id);
    expect(failed!.status).toBe(TaskStatus.Failed);
    expect(failed!.error).toContain('No bars');
  });

  it('回测成功后调用 syncBacktest', async () => {
    const bridge = createMockBridge();
    const handler = new BacktestHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = await queue.submit(TaskType.Backtest, {
      strategy: 'mock',
      symbol: 'TEST',
      timeframe: TimeFrame.D1,
    });

    await queue.processAll();

    // 验证 syncBacktest 被调用
    const calls = (bridge.call as ReturnType<typeof vi.fn>).mock.calls;
    const syncCall = calls.find((c: Record<string, unknown>[]) => {
      const req = c[0] as Record<string, unknown>;
      return req?.command === 'syncBacktest';
    });
    expect(syncCall).toBeDefined();
    const syncReq = syncCall![0] as Record<string, unknown>;
    expect(syncReq.strategyName).toBe('mock');
    expect(syncReq.symbol).toBe('TEST');
    expect(syncReq.backtestData).toBeDefined();
  });

  it('sync 失败不影响回测结果', async () => {
    const callMock = vi.fn<() => Promise<PythonResult>>();
    // 第 1 次：backtest 成功，第 2 次：analyze 成功，第 3 次：sync 失败
    callMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          config: {},
          metrics: { totalReturn: 0.1, annualizedReturn: 0.15, sharpeRatio: 1.5, maxDrawdown: 0.08, winRate: 0.55, totalTrades: 10 },
          equityCurve: [],
          trades: [],
        },
      })
      .mockResolvedValueOnce({ ok: true, data: { analysis: {} } })
      .mockRejectedValueOnce(new Error('sync failed'));

    const bridge = createMockBridge({ call: callMock });
    const handler = new BacktestHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = await queue.submit(TaskType.Backtest, {
      strategy: 'mock',
      symbol: 'TEST',
      timeframe: TimeFrame.D1,
    });

    await queue.processAll();
    const completed = await queue.get(task.id);
    expect(completed!.status).toBe(TaskStatus.Completed);
    expect(completed!.result!.backtestResult).toBeDefined();
  });
});
