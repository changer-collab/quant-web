import { describe, it, expect, vi, afterEach } from 'vitest';
import { BacktestHandler } from '../src/handlers/backtest-handler.js';
import { TaskType, TaskStatus, TimeFrame } from '../src/types.js';
import type { PythonBridge, PythonResult } from '../src/python-bridge.js';

function createMockBridge(override?: Partial<PythonBridge>): PythonBridge {
  const defaultData = {
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
  };
  return {
    call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
      ok: true,
      data: defaultData,
    }),
    streamCall: vi.fn(async (_request, onEvent) => {
      onEvent({ event: 'result', data: defaultData });
      return { ok: true, data: defaultData };
    }),
    ...override,
  } as unknown as PythonBridge;
}

function makeTask(payload: Record<string, unknown>) {
  return {
    id: 'test-task',
    type: TaskType.Backtest as never,
    status: TaskStatus.Running,
    payload,
    submittedAt: Date.now(),
    startedAt: Date.now(),
  };
}

describe('BacktestHandler', () => {
  it('执行回测任务', async () => {
    const bridge = createMockBridge();
    const handler = new BacktestHandler(bridge);
    const result = await handler.handle(
      makeTask({
        strategy: 'mock',
        symbol: 'TEST',
        timeframe: TimeFrame.D1,
        initialCash: 1000000,
        slippage: 0.001,
        configSnapshot: { strategy: 'mock', params: {}, category: 'non_factor', subcategory: null },
      }),
      undefined
    );
    expect(result.backtestResult).toBeDefined();
  });

  it('在实际执行前后发出可去重的研究事件', async () => {
    const bridge = createMockBridge();
    const handler = new BacktestHandler(bridge);
    const events: unknown[] = [];

    await handler.handle(
      makeTask({
        strategy: 'mock',
        symbol: 'TEST',
        timeframe: TimeFrame.D1,
        initialCash: 1000000,
        startTs: 100,
        endTs: 200,
        configSnapshot: { strategy: 'mock', params: { shortWindow: 5 }, category: 'non_factor' },
      }),
      (event) => events.push(event)
    );

    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'research',
        data: expect.objectContaining({
          eventType: 'backtest_submitted',
          dedupeKey: 'backtest_submitted:test-task',
        }),
      })
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        event: 'research',
        data: expect.objectContaining({
          eventType: 'backtest_completed',
          dedupeKey: 'backtest_completed:test-task',
        }),
      })
    );
  });

  it('研究事件落库失败时不启动实际回测', async () => {
    const bridge = createMockBridge();
    const handler = new BacktestHandler(bridge);

    await expect(
      handler.handle(
        makeTask({
          strategy: 'mock',
          symbol: 'TEST',
          timeframe: TimeFrame.D1,
          configSnapshot: { strategy: 'mock', params: {}, category: 'non_factor' },
        }),
        async (event) => {
          if (event.event === 'research') throw new Error('research API unavailable');
        }
      )
    ).rejects.toThrow('research API unavailable');
    expect(bridge.streamCall).not.toHaveBeenCalled();
  });

  it('Python 返回错误时抛异常', async () => {
    const bridge = createMockBridge({
      call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
        ok: false,
        error: { code: 'NO_DATA', message: 'No bars for TEST' },
      }),
    });
    const handler = new BacktestHandler(bridge);
    await expect(
      handler.handle(
        makeTask({
          strategy: 'mock',
          symbol: 'TEST',
          timeframe: TimeFrame.D1,
          configSnapshot: {
            strategy: 'mock',
            params: {},
            category: 'non_factor',
            subcategory: null,
          },
        }),
        undefined
      )
    ).rejects.toThrow('No bars');
  });

  it('回测成功后调用 syncBacktest', async () => {
    const bridge = createMockBridge();
    const handler = new BacktestHandler(bridge);
    await handler.handle(
      makeTask({
        strategy: 'mock',
        symbol: 'TEST',
        timeframe: TimeFrame.D1,
        configSnapshot: { strategy: 'mock', params: {}, category: 'non_factor', subcategory: null },
      }),
      undefined
    );
    const calls = (bridge.call as ReturnType<typeof vi.fn>).mock.calls;
    const syncCall = calls.find((c: unknown[]) => {
      const req = c[0] as Record<string, unknown>;
      return req?.command === 'syncBacktest';
    });
    expect(syncCall).toBeDefined();
    const syncReq = syncCall![0] as Record<string, unknown>;
    expect(syncReq.strategyName).toBe('mock');
    expect(syncReq.symbol).toBe('TEST');
  });

  it('sync 失败不影响回测结果', async () => {
    const callMock = vi.fn<() => Promise<PythonResult>>();
    callMock
      .mockResolvedValueOnce({
        ok: true,
        data: {
          config: {},
          metrics: {
            totalReturn: 0.1,
            annualizedReturn: 0.15,
            sharpeRatio: 1.5,
            maxDrawdown: 0.08,
            winRate: 0.55,
            totalTrades: 10,
          },
          equityCurve: [],
          trades: [],
        },
      })
      .mockResolvedValueOnce({ ok: true, data: { analysis: {} } })
      .mockRejectedValueOnce(new Error('sync failed'));

    const bridge = createMockBridge({ call: callMock });
    const handler = new BacktestHandler(bridge);
    const result = await handler.handle(
      makeTask({
        strategy: 'mock',
        symbol: 'TEST',
        timeframe: TimeFrame.D1,
        configSnapshot: { strategy: 'mock', params: {}, category: 'non_factor', subcategory: null },
      }),
      undefined
    );
    expect(result.backtestResult).toBeDefined();
  });
});

describe('BacktestHandler - configSnapshot', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('传递 configSnapshot.category/subcategory/snapshotParams 到 bridge 请求', async () => {
    const bridge = createMockBridge();
    const handler = new BacktestHandler(bridge);
    await handler.handle(
      makeTask({
        strategy: 'dual_ma',
        symbol: 'TEST',
        timeframe: TimeFrame.D1,
        configSnapshot: {
          strategy: 'dual_ma',
          params: { period: 20, offset: 5 },
          category: 'non_factor',
          subcategory: 'trend_cta',
        },
      }),
      undefined
    );
    const calls = (bridge.call as ReturnType<typeof vi.fn>).mock.calls;
    const backtestCall = calls.find((c: unknown[]) => {
      const req = c[0] as Record<string, unknown>;
      return req?.command === 'backtest';
    });
    expect(backtestCall).toBeDefined();
    const req = backtestCall![0] as Record<string, unknown>;
    const config = req.config as Record<string, unknown>;
    expect(config.category).toBe('non_factor');
    expect(config.subcategory).toBe('trend_cta');
    expect(config.snapshotParams).toEqual({ period: 20, offset: 5 });
  });

  it('configSnapshot 缺失时抛异常', async () => {
    const handler = new BacktestHandler(createMockBridge());
    await expect(
      handler.handle(
        makeTask({
          strategy: 'dual_ma',
          symbol: 'TEST',
          timeframe: TimeFrame.D1,
        }),
        undefined
      )
    ).rejects.toThrow('configSnapshot required for backtest');
  });
});
