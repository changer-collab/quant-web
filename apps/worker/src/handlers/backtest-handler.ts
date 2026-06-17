import { TaskType } from '../types.js';
import { TimeFrame } from '../types.js';
import type { BacktestResult, StreamEvent } from '../types.js';
import type { TaskHandler, TaskRecord, TaskEventHandler } from '../queue.js';
import { PythonBridge } from '../python-bridge.js';

/** 回测任务参数 */
export interface BacktestPayload {
  strategyName: string;
  symbol: string;
  timeframe: TimeFrame;
  initialCash?: number;
  slippage?: number;
}

/** 回测任务结果 */
export interface BacktestTaskResult {
  taskId: string;
  backtestResult: BacktestResult;
}

/** 回测任务处理器 — 通过 Python CLI 执行回测 */
export class BacktestHandler implements TaskHandler {
  readonly type = TaskType.Backtest;

  constructor(private readonly bridge: PythonBridge) {}

  async handle(task: TaskRecord, onEvent?: TaskEventHandler): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as BacktestPayload;

    const request = {
      command: 'backtest',
      strategy: payload.strategyName,
      config: {
        initialCash: payload.initialCash,
        slippage: payload.slippage,
      },
      dataRange: {
        symbol: payload.symbol,
        timeframe: payload.timeframe,
      },
    };

    // 优先使用流式调用
    if (onEvent) {
      const result = await this.bridge.streamCall(request, onEvent);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Python backtest failed');
      }
      return { taskId: task.id, backtestResult: result.data } as Record<string, unknown>;
    }

    // fallback: 无回调时用同步调用
    const result = await this.bridge.call(request);
    if (!result.ok) {
      throw new Error(result.error?.message ?? 'Python backtest failed');
    }

    return { taskId: task.id, backtestResult: result.data } as Record<string, unknown>;
  }
}
