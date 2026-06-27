/**
 * Backtest Agent — 标准化回测调用
 *
 * 将前端/Loop 的回测请求转换为 Python CLI 格式，
 * 通过 PythonAgent 执行并返回标准化结果。
 */

import type { AgentExecutor, AgentRequest, AgentResponse } from './base.js';

/** 回测参数（前端/Loop 格式） */
export interface BacktestParams {
  strategy: string;
  symbol?: string;
  symbols?: string[];
  timeframe?: string;
  initialCash?: number;
  slippage?: number;
  startTs?: number;
  endTs?: number;
  params?: Record<string, unknown>;
}

export class BacktestAgent implements AgentExecutor {
  readonly agentType = 'backtest' as const;

  constructor(private readonly inner: AgentExecutor) {}

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const params = request.params as unknown as BacktestParams;

    // 转换为 Python CLI 格式
    const cliParams = {
      command: 'backtest',
      strategy: params.strategy,
      config: {
        initialCash: params.initialCash,
        slippage: params.slippage,
        strategyParams: params.params ?? {},
      },
      dataRange: {
        symbol: params.symbol,
        symbols: params.symbols,
        timeframe: params.timeframe ?? '1d',
        startTs: params.startTs,
        endTs: params.endTs,
      },
    };

    return this.inner.execute({
      ...request,
      params: cliParams,
    });
  }
}
