import { describe, it, expect, vi } from 'vitest';
import { DiagnosticsHandler } from '../src/handlers/diagnostics-handler.js';
import { TaskQueue } from '../src/queue.js';
import { TaskType, TaskStatus } from '../src/types.js';
import type { PythonBridge, PythonResult } from '../src/python-bridge.js';

function createMockBridge(override?: Partial<PythonBridge>): PythonBridge {
  return {
    call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
      ok: true,
      data: {
        type: 'non_factor',
        param_sensitivity: [],
        signal_quality: { total_signals: 0, win_rate: 0, avg_holding_bars: 0, profit_factor: 0, max_consecutive_losses: 0 },
        slippage_stress: [],
      },
    }),
    streamCall: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
      ok: true,
      data: {
        type: 'non_factor',
        param_sensitivity: [],
        signal_quality: { total_signals: 0, win_rate: 0, avg_holding_bars: 0, profit_factor: 0, max_consecutive_losses: 0 },
        slippage_stress: [],
      },
    }),
    ...override,
  } as unknown as PythonBridge;
}

describe('DiagnosticsHandler - fail-closed', () => {
  it('Python 返回 ok:false 时抛出异常', async () => {
    const bridge = createMockBridge({
      call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
        ok: false,
        error: { code: 'NO_PRICE_DATA', message: 'No price data for TEST' },
      }),
    });
    const handler = new DiagnosticsHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    await queue.submit(TaskType.Diagnostics, {
      strategy: 'dual_ma',
      category: 'non_factor',
      configSnapshot: { strategy: 'dual_ma', params: { period: 20 } },
    });

    await queue.processAll();
    const tasks = await queue.list();
    const failed = tasks.find(t => t.status === TaskStatus.Failed);
    expect(failed).toBeDefined();
    expect(failed!.error).toContain('No price data');
  });

  it('Python 返回 ok:true 但无 data 时抛出异常', async () => {
    const bridge = createMockBridge({
      call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
        ok: true,
        data: undefined,
      }),
    });
    const handler = new DiagnosticsHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    await queue.submit(TaskType.Diagnostics, {
      strategy: 'dual_ma',
      category: 'non_factor',
      configSnapshot: { strategy: 'dual_ma', params: { period: 20 } },
    });

    await queue.processAll();
    const tasks = await queue.list();
    const failed = tasks.find(t => t.status === TaskStatus.Failed);
    expect(failed).toBeDefined();
    expect(failed!.error).toContain('empty diagnostics result');
  });

  it('streamCall 返回 ok:false 时抛出异常', async () => {
    const bridge = createMockBridge({
      streamCall: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
        ok: false,
        error: { code: 'DIAGNOSTICS_ERROR', message: 'Python diagnostics crashed' },
      }),
    });
    const handler = new DiagnosticsHandler(bridge);

    // 直接调用 handler.handle（模拟有 onEvent 回调时走 streamCall 路径）
    await expect(
      handler.handle(
        {
          id: 'test-task',
          type: TaskType.Diagnostics as never,
          status: TaskStatus.Running,
          payload: { strategy: 'dual_ma', category: 'non_factor', configSnapshot: { strategy: 'dual_ma', params: {} } },
          submittedAt: Date.now(),
          startedAt: Date.now(),
        },
        vi.fn(),
      ),
    ).rejects.toThrow('Python diagnostics crashed');
  });

  it('streamCall 返回 ok:true 但无 data 时抛出异常', async () => {
    const bridge = createMockBridge({
      streamCall: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
        ok: true,
        data: undefined,
      }),
    });
    const handler = new DiagnosticsHandler(bridge);

    await expect(
      handler.handle(
        {
          id: 'test-task',
          type: TaskType.Diagnostics as never,
          status: TaskStatus.Running,
          payload: { strategy: 'dual_ma', category: 'non_factor', configSnapshot: { strategy: 'dual_ma', params: {} } },
          submittedAt: Date.now(),
          startedAt: Date.now(),
        },
        vi.fn(),
      ),
    ).rejects.toThrow('empty diagnostics result');
  });

  it('Python 返回 ok:true 且有 data 时正常返回诊断结果', async () => {
    const diagData = {
      type: 'non_factor',
      param_sensitivity: [
        { param: 'period', values: [10, 15, 20, 25, 30], returns: [0.01, 0.02, 0.03, 0.02, 0.01], sharpe: [0.5, 0.8, 1.2, 0.9, 0.6] },
      ],
      signal_quality: { total_signals: 15, win_rate: 0.6, avg_holding_bars: 5, profit_factor: 2.1, max_consecutive_losses: 3 },
      slippage_stress: [
        { bps: 1, return: 0.03, sharpe: 1.2, trade_count: 15 },
        { bps: 3, return: 0.025, sharpe: 1.0, trade_count: 15 },
        { bps: 5, return: 0.02, sharpe: 0.8, trade_count: 15 },
        { bps: 10, return: 0.01, sharpe: 0.5, trade_count: 15 },
      ],
    };

    const bridge = createMockBridge({
      call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({ ok: true, data: diagData }),
    });
    const handler = new DiagnosticsHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    await queue.submit(TaskType.Diagnostics, {
      strategy: 'dual_ma',
      category: 'non_factor',
      configSnapshot: { strategy: 'dual_ma', params: { period: 20 } },
    });

    await queue.processAll();
    const tasks = await queue.list();
    const completed = tasks.find(t => t.status === TaskStatus.Completed);
    expect(completed).toBeDefined();
    expect(completed!.result).toBeDefined();

    const result = completed!.result!;
    expect(result.taskId).toBeDefined();
    expect(result.diagnostics).toEqual(diagData);
  });

  it('ok:false 且无 error.message 时抛出通用错误消息', async () => {
    const bridge = createMockBridge({
      call: vi.fn<() => Promise<PythonResult>>().mockResolvedValue({
        ok: false,
        error: undefined,
      }),
    });
    const handler = new DiagnosticsHandler(bridge);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    await queue.submit(TaskType.Diagnostics, {
      strategy: 'dual_ma',
      category: 'non_factor',
      configSnapshot: { strategy: 'dual_ma', params: {} },
    });

    await queue.processAll();
    const tasks = await queue.list();
    const failed = tasks.find(t => t.status === TaskStatus.Failed);
    expect(failed).toBeDefined();
    expect(failed!.error).toContain('Python diagnostics failed');
  });
});
