/**
 * Python Agent — 通过 PythonBridge 调用 Python 引擎
 *
 * 将 PythonBridge 的 call/streamCall 封装为 AgentExecutor 接口，
 * 使上层（LoopHandler、Worker）能通过统一接口调用 Python 引擎。
 */

import type { PythonBridge } from '../python-bridge.js';
import type { AgentExecutor, AgentRequest, AgentResponse } from './base.js';

export class PythonAgent implements AgentExecutor {
  readonly agentType = 'backtest' as const;

  constructor(private readonly bridge: PythonBridge) {}

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      let result;
      if (request.onEvent) {
        result = await this.bridge.streamCall(
          request.params,
          request.onEvent as (event: { event: string; [key: string]: unknown }) => void,
        );
      } else {
        result = await this.bridge.call(request.params);
      }

      const durationMs = Date.now() - startTime;

      if (result.ok) {
        return {
          success: true,
          taskId: request.taskId,
          data: result.data as Record<string, unknown>,
          durationMs,
        };
      } else {
        return {
          success: false,
          taskId: request.taskId,
          error: result.error,
          durationMs,
        };
      }
    } catch (err) {
      return {
        success: false,
        taskId: request.taskId,
        error: { code: 'AGENT_ERROR', message: String(err) },
        durationMs: Date.now() - startTime,
      };
    }
  }
}
