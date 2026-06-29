/**
 * Diagnostics Handler — 诊断任务处理
 *
 * 通过 Python CLI 执行策略诊断（参数敏感性、信号质量等），
 * 若 Python CLI 尚未实现则该 handler 作为占位符直接回显输入数据。
 */

import { TaskType } from '../types.js';
import type { TaskHandler, TaskRecord, TaskEventHandler } from '../queue.js';
import { PythonBridge } from '../python-bridge.js';

/** 诊断任务参数 */
export interface DiagnosticsPayload {
  strategy: string;
  configSnapshot?: { strategy: string; params: Record<string, unknown> };
  category?: string;
  [key: string]: unknown;
}

/** 诊断任务处理器 */
export class DiagnosticsHandler implements TaskHandler {
  readonly type = TaskType.Diagnostics;

  constructor(private readonly bridge: PythonBridge) {}

  async handle(task: TaskRecord, onEvent?: TaskEventHandler): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as DiagnosticsPayload;

    // 尝试通过 Python CLI 执行诊断
    const request = {
      command: 'diagnostics',
      strategy: payload.strategy,
      category: payload.category ?? 'non_factor',
      config: {
        strategyParams: payload.configSnapshot?.params ?? {},
      },
    };

    // 优先使用流式调用
    let resultData: Record<string, unknown>;
    if (onEvent) {
      const result = await this.bridge.streamCall(request, onEvent);
      if (result.ok && result.data) {
        resultData = result.data as Record<string, unknown>;
      } else {
        // Python CLI 尚未实现 diagnostics 命令时回显输入
        resultData = { rawPayload: payload, note: 'diagnostics CLI not implemented, echoing input' };
      }
    } else {
      const result = await this.bridge.call(request);
      if (result.ok && result.data) {
        resultData = result.data as Record<string, unknown>;
      } else {
        resultData = { rawPayload: payload, note: 'diagnostics CLI not implemented, echoing input' };
      }
    }

    return {
      taskId: task.id,
      diagnostics: resultData,
    };
  }
}
