import { describe, it, expect, vi, afterEach } from 'vitest';
import { BacktestAgent } from '../../src/agents/backtest-agent.js';
import type { AgentExecutor } from '../../src/agents/base.js';

function createMockExecutor(returnData: Record<string, unknown> = {}): AgentExecutor {
  return {
    agentType: 'backtest',
    execute: vi.fn().mockResolvedValue({
      success: true,
      taskId: 'task-1',
      data: returnData,
    }),
  };
}

describe('BacktestAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('wraps PythonAgent for backtest execution', async () => {
    const inner = createMockExecutor({ metrics: { sharpeRatio: 1.5 } });
    const agent = new BacktestAgent(inner);

    const response = await agent.execute({
      agentType: 'backtest',
      taskId: 'task-1',
      params: {
        command: 'backtest',
        strategy: 'dual_ma',
        config: { initialCash: 100000 },
        dataRange: { symbol: '000001.SZ', timeframe: '1d' },
      },
    });

    expect(response.success).toBe(true);
    expect(response.data?.metrics).toEqual({ sharpeRatio: 1.5 });
  });

  it('transforms params to Python CLI format', async () => {
    const inner = createMockExecutor();
    const agent = new BacktestAgent(inner);

    await agent.execute({
      agentType: 'backtest',
      taskId: 'task-2',
      params: {
        strategy: 'dual_ma',
        symbol: '000001.SZ',
        timeframe: '1d',
        initialCash: 100000,
      },
    });

    // 验证参数转换
    expect(inner.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          command: 'backtest',
          strategy: 'dual_ma',
        }),
      })
    );
  });

  it('传递 configSnapshot.category/subcategory/snapshotParams', async () => {
    const inner = createMockExecutor();
    const agent = new BacktestAgent(inner);

    await agent.execute({
      agentType: 'backtest',
      taskId: 'task-3',
      params: {
        strategy: 'dual_ma',
        symbol: '000001.SZ',
        timeframe: '1d',
        configSnapshot: {
          strategy: 'dual_ma',
          params: { period: 20 },
          category: 'non_factor',
          subcategory: 'trend_cta',
        },
      },
    });

    expect(inner.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          config: expect.objectContaining({
            category: 'non_factor',
            subcategory: 'trend_cta',
            snapshotParams: { period: 20 },
            strategyParams: { period: 20 },
          }),
        }),
      })
    );
  });

  it('configSnapshot 缺失时降级到 params.params 并输出 WARN', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const inner = createMockExecutor();
    const agent = new BacktestAgent(inner);

    await agent.execute({
      agentType: 'backtest',
      taskId: 'task-4',
      params: {
        strategy: 'dual_ma',
        symbol: '000001.SZ',
        timeframe: '1d',
        params: { period: 10 },
        // 没有 configSnapshot
      },
    });

    // 验证 WARN
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'deprecated: params.params will be removed, use configSnapshot.params'
      )
    );

    // 验证降级后的 params
    expect(inner.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        params: expect.objectContaining({
          config: expect.objectContaining({
            snapshotParams: { period: 10 },
            strategyParams: { period: 10 },
          }),
        }),
      })
    );

    warnSpy.mockRestore();
  });
});
