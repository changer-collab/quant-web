import { TaskType } from '../types.js';
import { TimeFrame } from '../types.js';
import type { BacktestResult } from '../types.js';
import type { TaskHandler, TaskRecord, TaskEventHandler } from '../queue.js';
import { PythonBridge } from '../python-bridge.js';
import { resolveDbPath } from '../db-path.js';

/** 回测任务参数 */
export interface BacktestPayload {
  strategy: string;
  symbol: string;
  timeframe: TimeFrame;
  initialCash?: number;
  slippage?: number;
  startTs?: number;
  endTs?: number;
  params?: Record<string, unknown>;
  configSnapshot?: { strategy: string; params: Record<string, unknown> };
  dbPath?: string;
}

/** 回测任务结果 */
export interface BacktestTaskResult {
  taskId: string;
  backtestResult: BacktestResult;
  /** AI 分析结果（可选，回测成功后自动生成） */
  analysis?: unknown;
}

/** 回测任务处理器 — 通过 Python CLI 执行回测，完成后触发 AI 分析 */
export class BacktestHandler implements TaskHandler {
  readonly type = TaskType.Backtest;

  constructor(private readonly bridge: PythonBridge) {}

  async handle(task: TaskRecord, onEvent?: TaskEventHandler): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as BacktestPayload;

    const request = {
      command: 'backtest',
      strategy: payload.strategy,
      config: {
        initialCash: payload.initialCash,
        slippage: payload.slippage,
        strategyParams: payload.configSnapshot?.params ?? payload.params ?? {},
      },
      dataRange: {
        dbPath: payload.dbPath ?? resolveDbPath(),
        symbol: payload.symbol,
        timeframe: payload.timeframe,
        startTs: payload.startTs,
        endTs: payload.endTs,
      },
    };

    // 优先使用流式调用
    let backtestData: Record<string, unknown>;
    if (onEvent) {
      const result = await this.bridge.streamCall(request, onEvent);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Python backtest failed');
      }
      backtestData = result.data as Record<string, unknown>;
    } else {
      // fallback: 无回调时用同步调用
      const result = await this.bridge.call(request);
      if (!result.ok) {
        throw new Error(result.error?.message ?? 'Python backtest failed');
      }
      backtestData = result.data as Record<string, unknown>;
    }

    // 回测成功后，触发 AI 分析
    let analysis: unknown = undefined;
    try {
      const analyzeRequest = {
        command: 'analyze',
        config: backtestData.config ?? {},
        metrics: backtestData.metrics ?? {},
        strategyLogic: '',
      };
      const analyzeResult = await this.bridge.call(analyzeRequest);
      if (analyzeResult.ok) {
        analysis = (analyzeResult.data as Record<string, unknown>)?.analysis;
      }
    } catch {
      // AI 分析失败不影响回测结果
    }

    // 回测成功后，同步到 Obsidian（失败不影响结果）
    try {
      const syncRequest = {
        command: 'syncBacktest',
        strategyName: payload.strategy,
        symbol: payload.symbol,
        backtestData,
      };
      await this.bridge.call(syncRequest);
    } catch {
      // sync 失败不影响回测结果
    }

    return { taskId: task.id, backtestResult: backtestData, analysis } as Record<string, unknown>;
  }
}
