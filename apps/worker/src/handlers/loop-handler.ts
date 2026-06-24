/**
 * 循环任务处理器骨架 — 编排多次子任务迭代
 *
 * 当前阶段：骨架实现，只记录循环配置并返回空结果。
 * 后续：根据 LoopConfig.type 调度多次子任务（backtest/ai/factor）。
 * 循环状态由 Worker 通过 API 任务表持久化，不在 Handler 内部管理。
 */
import { TaskType } from '../types.js';
import type { TaskHandler, TaskRecord } from '../queue.js';
import type { PythonBridge } from '../python-bridge.js';

/** 循环任务参数 */
export interface LoopPayload {
  id: string;
  type: string;
  maxIterations: number;
  subtaskConfig: Record<string, unknown>;
}

/** 单次迭代记录（只存引用和摘要，不内联完整结果） */
export interface IterationRecord {
  id: string;
  loopId: string;
  sequence: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  subtaskId?: string;
  summary: Record<string, unknown>;
  startedAt?: number;
  completedAt?: number;
}

/** 循环任务结果 */
export interface LoopResult {
  loopId: string;
  config: LoopPayload;
  status: 'completed' | 'failed' | 'cancelled';
  iterations: IterationRecord[];
  summary: {
    totalIterations: number;
    completedIterations: number;
    failedIterations: number;
    durationMs?: number;
    bestResult?: Record<string, unknown>;
  };
}

/** 循环任务处理器骨架 — 编排多次子任务迭代 */
export class LoopHandler implements TaskHandler {
  readonly type = TaskType.Backtest; // 暂时复用 backtest 类型，后续可新增 Loop 类型

  constructor(private readonly bridge: PythonBridge) {}

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    // 当前阶段：骨架实现，只记录循环配置
    // 后续：根据 LoopConfig.type 调度多次子任务
    const config = task.payload as unknown as LoopPayload;
    return {
      taskId: task.id,
      loopResult: {
        loopId: config.id,
        config,
        status: 'completed',
        iterations: [],
        summary: {
          totalIterations: 0,
          completedIterations: 0,
          failedIterations: 0,
        },
      } satisfies LoopResult,
    };
  }
}
