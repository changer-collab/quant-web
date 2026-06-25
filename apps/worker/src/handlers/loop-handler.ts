/**
 * 循环任务处理器 — 编排多次子任务迭代
 *
 * 通过 AgentExecutor 接口调用子任务，实现循环编排与执行解耦。
 * 循环状态由 Worker 通过 API 任务表持久化，不在 Handler 内部管理。
 */
import { TaskType } from '../types.js';
import type { TaskHandler, TaskRecord } from '../queue.js';
import type { AgentExecutor, AgentRequest } from '../agents/base.js';
import type { PythonBridge } from '../python-bridge.js';
import { createBacktestAgent } from '../agents/index.js';

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

/** 循环任务处理器 — 编排多次子任务迭代 */
export class LoopHandler implements TaskHandler {
  readonly type = TaskType.Backtest; // 暂时复用 backtest 类型，后续可新增 Loop 类型

  private readonly agentExecutor: AgentExecutor;

  constructor(bridge: PythonBridge) {
    // 默认使用回测 Agent，可根据 loopType 动态切换
    this.agentExecutor = createBacktestAgent(bridge);
  }

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const config = task.payload as unknown as LoopPayload;
    const iterations: IterationRecord[] = [];

    // 当前阶段：骨架实现，只记录循环配置
    // 后续：根据 LoopConfig.type 调度多次子任务
    // 示例循环结构：
    // for (let i = 0; i < config.maxIterations; i++) {
    //   const iteration = await this.runIteration(config, i);
    //   iterations.push(iteration);
    //   if (this.shouldStop(iterations)) break;
    // }

    return {
      taskId: task.id,
      loopResult: {
        loopId: config.id,
        config,
        status: 'completed',
        iterations,
        summary: {
          totalIterations: 0,
          completedIterations: 0,
          failedIterations: 0,
        },
      } satisfies LoopResult,
    };
  }

  /** 执行单次迭代（骨架） */
  private async runIteration(
    config: LoopPayload,
    sequence: number,
  ): Promise<IterationRecord> {
    const request: AgentRequest = {
      agentType: 'backtest',
      taskId: `${config.id}-iter-${sequence}`,
      params: config.subtaskConfig,
    };

    const response = await this.agentExecutor.execute(request);

    return {
      id: request.taskId,
      loopId: config.id,
      sequence,
      status: response.success ? 'completed' : 'failed',
      summary: response.data ?? {},
      startedAt: Date.now(),
      completedAt: Date.now(),
    };
  }
}
