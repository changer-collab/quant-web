import { describe, it, expect } from 'vitest';
import type { AgentExecutor, AgentRequest, AgentResponse } from '../../src/agents/base.js';

describe('Agent interfaces', () => {
  it('AgentRequest has required fields', () => {
    const request: AgentRequest = {
      agentType: 'backtest',
      taskId: 'task-1',
      params: { strategy: 'dual_ma' },
    };
    expect(request.agentType).toBe('backtest');
    expect(request.taskId).toBe('task-1');
  });

  it('AgentResponse has required fields', () => {
    const response: AgentResponse = {
      success: true,
      taskId: 'task-1',
      data: { result: 'ok' },
    };
    expect(response.success).toBe(true);
    expect(response.taskId).toBe('task-1');
  });
});
