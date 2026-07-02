// apps/worker/tests/agents/python-agent.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PythonAgent } from '../../src/agents/python-agent.js';
import type { PythonBridge } from '../../src/python-bridge.js';

function createMockBridge(returnData: Record<string, unknown> = {}): PythonBridge {
  return {
    call: vi.fn().mockResolvedValue({ ok: true, data: returnData }),
    streamCall: vi.fn().mockResolvedValue({ ok: true, data: returnData }),
  } as unknown as PythonBridge;
}

describe('PythonAgent', () => {
  it('executes command via PythonBridge', async () => {
    const bridge = createMockBridge({ result: 'ok' });
    const agent = new PythonAgent(bridge);

    const response = await agent.execute({
      agentType: 'backtest',
      taskId: 'task-1',
      params: { command: 'backtest', strategy: 'dual_ma' },
    });

    expect(response.success).toBe(true);
    expect(response.taskId).toBe('task-1');
    expect(bridge.call).toHaveBeenCalledWith({ command: 'backtest', strategy: 'dual_ma' });
  });

  it('handles bridge error', async () => {
    const bridge = {
      call: vi
        .fn()
        .mockResolvedValue({ ok: false, error: { code: 'PYTHON_ERROR', message: 'Failed' } }),
      streamCall: vi.fn(),
    } as unknown as PythonBridge;
    const agent = new PythonAgent(bridge);

    const response = await agent.execute({
      agentType: 'backtest',
      taskId: 'task-2',
      params: { command: 'backtest' },
    });

    expect(response.success).toBe(false);
    expect(response.error?.code).toBe('PYTHON_ERROR');
  });

  it('supports stream mode with onEvent callback', async () => {
    const bridge = createMockBridge({ result: 'ok' });
    const agent = new PythonAgent(bridge);
    const onEvent = vi.fn();

    await agent.execute({
      agentType: 'backtest',
      taskId: 'task-3',
      params: { command: 'backtest' },
      onEvent,
    });

    expect(bridge.streamCall).toHaveBeenCalled();
  });
});
