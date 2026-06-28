import { describe, it, expect, vi } from 'vitest';
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
    expect(inner.execute).toHaveBeenCalledWith(expect.objectContaining({
      params: expect.objectContaining({
        command: 'backtest',
        strategy: 'dual_ma',
      }),
    }));
  });
});
