/**
 * Diagnostics Handler — 诊断任务处理
 *
 * 通过 Python CLI 执行策略诊断（参数敏感性、信号质量等）。
 * 当 Python 返回错误或无数据时抛出异常，由 main.ts 的 processTask
 * 统一 catch 并调用 /fail 标记任务为失败（fail-closed）。
 */

import { TaskType } from '../types.js';
import type { TaskHandler, TaskRecord, TaskEventHandler } from '../queue.js';
import { PythonBridge } from '../python-bridge.js';

/** 诊断任务参数 */
export interface DiagnosticsPayload {
  strategy: string;
  configSnapshot?: { strategy: string; params: Record<string, unknown> };
  category?: string;
  symbol?: string;
  timeframe?: string;
  dataRange?: Record<string, unknown>;
  [key: string]: unknown;
}

/** 诊断任务处理器 */
export class DiagnosticsHandler implements TaskHandler {
  readonly type = TaskType.Diagnostics;

  constructor(private readonly bridge: PythonBridge) {}

  async handle(task: TaskRecord, onEvent?: TaskEventHandler): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as DiagnosticsPayload;

    // 构建完整的诊断请求参数，与 Python run_diagnostics(params) 对齐
    const request = {
      command: 'diagnostics',
      strategy: payload.strategy,
      category: payload.category ?? 'non_factor',
      configSnapshot: payload.configSnapshot ?? { strategy: payload.strategy, params: {} },
      symbol: payload.symbol ?? '',
      timeframe: payload.timeframe ?? '1d',
      dataRange: payload.dataRange ?? {},
    };

    // 优先使用流式调用
    let resultData: Record<string, unknown>;
    if (onEvent) {
      const result = await this.bridge.streamCall(request, onEvent);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Python diagnostics failed');
      }
      if (!result.data) {
        throw new Error('empty diagnostics result');
      }
      resultData = result.data as Record<string, unknown>;
    } else {
      const result = await this.bridge.call(request);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Python diagnostics failed');
      }
      if (!result.data) {
        throw new Error('empty diagnostics result');
      }
      resultData = result.data as Record<string, unknown>;
    }

    return {
      taskId: task.id,
      diagnostics: resultData,
    };
  }
}
