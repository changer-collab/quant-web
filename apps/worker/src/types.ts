/**
 * Worker 层内联类型定义
 * 核心逻辑已迁移到 Python 包，这些类型仅供 Worker 层使用
 */

export { TimeFrame } from '@quant/data-center';
export type { Bar } from '@quant/data-center';

/** 任务类型 */
export enum TaskType {
  Backtest = 'backtest',
  FactorCompute = 'factor_compute',
  FactorEval = 'factor_eval',
  AITrain = 'ai_train',
  Collect = 'collect',
  Diagnostics = 'diagnostics',
}

/** 任务状态 */
export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
  Cancelled = 'cancelled',
}

/** 回测结果 */
export interface BacktestResult {
  config: Record<string, unknown>;
  trades: unknown[];
  equityCurve: unknown[];
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  };
}

/** Python CLI 流式事件 */
export interface StreamEvent {
  event: 'progress' | 'log' | 'result' | 'error';
  percent?: number;
  message?: string;
  level?: string;
  data?: unknown;
  error?: { code: string; message: string };
}
