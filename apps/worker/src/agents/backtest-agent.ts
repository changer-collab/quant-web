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
  configSnapshot?: {
    strategy: string;
    params: Record<string, unknown>;
    category?: string;
    subcategory?: string | null;
  };
}

export class BacktestAgent implements AgentExecutor {
  readonly agentType = 'backtest' as const;

  constructor(private readonly inner: AgentExecutor) {}

  async execute(request: AgentRequest): Promise<AgentResponse> {
    const params = request.params as unknown as BacktestParams;
    const configSnapshot = params.configSnapshot;

    // 优先使用 configSnapshot.params；configSnapshot 缺失时降级到 params.params（已废弃）
    let fallbackParams: Record<string, unknown>;
    let snapshotParams: Record<string, unknown>;
    if (configSnapshot) {
      snapshotParams = configSnapshot.params ?? {};
      fallbackParams = snapshotParams;
    } else {
      fallbackParams = params.params ?? {};
      snapshotParams = fallbackParams;
      console.warn('[backtest-agent] deprecated: params.params will be removed, use configSnapshot.params');
    }

    // 转换为 Python CLI 格式
    const cliParams = {
      command: 'backtest',
      strategy: params.strategy,
      config: {
        initialCash: params.initialCash,
        slippage: params.slippage,
        category: configSnapshot?.category,
        subcategory: configSnapshot?.subcategory ?? null,
        snapshotParams,
        strategyParams: fallbackParams,
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
