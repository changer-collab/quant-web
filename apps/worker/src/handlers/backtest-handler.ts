import { TaskType, TimeFrame } from '@quant/common';
import type { BacktestResult } from '@quant/common';
import type { TaskHandler, TaskRecord } from '../queue.js';
import { BacktestRunner } from '@quant/backtest-engine';
import type { DataCenter } from '@quant/data-center';
import type { Strategy } from '@quant/strategy-runtime';

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

/** 回测任务处理器 */
export class BacktestHandler implements TaskHandler {
  readonly type = TaskType.Backtest;

  constructor(
    private readonly dataCenter: DataCenter,
    private readonly strategyFactory: (name: string) => Strategy | undefined,
  ) {}

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as BacktestPayload;
    const strategy = this.strategyFactory(payload.strategyName);
    if (!strategy) throw new Error(`策略未找到: ${payload.strategyName}`);

    // 从数据中心流式加载行情数据
    const bars: import('@quant/common').Bar[] = [];
    for await (const bar of this.dataCenter.providers.market.loadBars(
      payload.symbol,
      payload.timeframe,
    )) {
      bars.push(bar);
    }
    if (bars.length === 0) throw new Error(`无行情数据: ${payload.symbol}`);

    const runner = new BacktestRunner({
      strategy,
      bars,
      initialCash: payload.initialCash,
      slippage: payload.slippage,
    });
    const result = runner.run();

    return { taskId: task.id, backtestResult: result } as unknown as Record<string, unknown>;
  }
}
