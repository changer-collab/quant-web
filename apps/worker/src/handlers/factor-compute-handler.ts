import { TaskType, TimeFrame } from '../types.js';
import type { Bar } from '../types.js';
import type { TaskHandler, TaskRecord } from '../queue.js';
import type { DataCenter } from '@quant/data-center';

/** 因子计算引擎接口（待 factor-lab 实现） */
export interface FactorComputeEngine {
  computeBatch(requests: FactorComputeRequest[]): FactorComputeBatchResult;
}

/** 因子计算请求 */
export interface FactorComputeRequest {
  factorId: string;
  symbol: string;
  bars: Bar[];
}

/** 因子计算批量结果 */
export interface FactorComputeBatchResult {
  results: Record<string, unknown>[];
  errors: string[];
}

/** 因子计算任务参数 */
export interface FactorComputePayload {
  factorIds: string[];
  symbol: string;
  timeframe: TimeFrame;
}

/** 因子计算任务处理器 */
export class FactorComputeHandler implements TaskHandler {
  readonly type = TaskType.FactorCompute;

  constructor(
    private readonly dataCenter: DataCenter,
    private readonly factorEngine: FactorComputeEngine,
  ) {}

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as FactorComputePayload;

    const bars: Bar[] = [];
    for await (const bar of this.dataCenter.providers.market.loadBars(
      payload.symbol,
      payload.timeframe,
    )) {
      bars.push(bar);
    }
    if (bars.length === 0) throw new Error(`无行情数据: ${payload.symbol}`);

    const requests: FactorComputeRequest[] = payload.factorIds.map((factorId) => ({
      factorId, symbol: payload.symbol, bars,
    }));

    const result = this.factorEngine.computeBatch(requests);
    return { taskId: task.id, results: result.results, errors: result.errors };
  }
}
