import { TaskType } from '@quant/common';
import type { TaskHandler, TaskRecord } from '../queue.js';

/** 因子评估调度器接口（待 factor-lab 实现） */
export interface FactorEvalScheduler {
  evaluateFactor(params: FactorEvalParams): Promise<FactorEvalResult>;
}

/** 因子评估参数 */
export interface FactorEvalParams {
  factorId: string;
  symbol: string;
  factorValues: unknown[];
  evalStart: number;
  evalEnd: number;
}

/** 因子评估结果 */
export interface FactorEvalResult {
  factorId: string;
  metrics: Record<string, number>;
}

/** 因子评估任务参数 */
export interface FactorEvalPayload {
  factorId: string;
  symbol: string;
  evalStart: number;
  evalEnd: number;
}

/** 因子评估任务处理器 */
export class FactorEvalHandler implements TaskHandler {
  readonly type = TaskType.FactorEval;

  constructor(private readonly evalScheduler: FactorEvalScheduler) {}

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as FactorEvalPayload;
    const result = await this.evalScheduler.evaluateFactor({
      factorId: payload.factorId,
      symbol: payload.symbol,
      factorValues: [],
      evalStart: payload.evalStart,
      evalEnd: payload.evalEnd,
    });
    return { taskId: task.id, evalResult: result };
  }
}
