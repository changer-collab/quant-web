import type { TimeFrame } from '@quant/data-center';

/** 采集数据子域 — 对齐数据中心的 5 个可采集子域（不含 quality） */
export enum CollectorDomain {
  Reference = 'reference',
  Market = 'market',
  L2 = 'l2',
  Fundamental = 'fundamental',
  Event = 'event',
  // 注意：不含 quality。Quality 是 data-center 的派生校验域，由数据质量检查器生成，
  // 不需要从外部数据源采集，因此不属于采集域。
}

/** 采集任务状态 */
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** 采集任务 */
export interface CollectorTask {
  id: string;
  domain: CollectorDomain;
  dataType: string;
  source: string;
  symbols: string[];
  timeframes?: TimeFrame[];
  start?: number;
  end?: number;
  status: TaskStatus;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/** 采集结果 */
export interface CollectorResult {
  taskId: string;
  domain: CollectorDomain;
  dataType: string;
  source: string;
  symbol: string;
  recordsWritten: number;
  lastTimestamp: number;
  duration: number;
}

/** 采集进度 — 每写入一个批次触发一次 */
export interface CollectorProgress {
  taskId: string;
  symbol: string;
  dataType: string;
  batchIndex: number;
  recordsWritten: number;
  lastTimestamp: number;
}

/** 适配器配置 — 每个数据源实例一份 */
export interface CollectorConfig {
  source: string;
  domain: CollectorDomain;
  dataType: string;
  options: Record<string, unknown>;
}
