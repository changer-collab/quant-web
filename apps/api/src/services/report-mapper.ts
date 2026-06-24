import type { BacktestResult } from '../types.js';
import type { BacktestReportFull } from '../types.js';

/** 将 BacktestResult 转换为 BacktestReportFull（未计算字段为 null/空，不含 mock 数据） */
export function mapBacktestResultToReport(
  result: BacktestResult,
  metadata: {
    strategyName: string;
    symbol: string;
    timeframe: string;
    startTime?: number;
    endTime?: number;
  }
): BacktestReportFull {
  const metrics = result.metrics;
  const config = result.config as Record<string, unknown>;

  return {
    id: `report-${Date.now()}`,
    status: 'completed',
    executiveSummary: {
      oneLineConclusion: '',
      recommendedForLive: false,
      keyMetrics: {
        annualizedReturn: metrics.annualizedReturn,
        maxDrawdown: metrics.maxDrawdown,
        sharpeRatio: metrics.sharpeRatio,
      },
      riskPoints: [],
    },
    overview: {
      name: metadata.strategyName,
      version: String(config.version ?? '1.0.0'),
      logic: String(config.logic ?? ''),
      strategyCategory: String(config.strategyKind ?? config.category ?? 'timing'),
      suitableMarketRegime: [],
      dataRange: {
        symbol: metadata.symbol,
        timeframe: metadata.timeframe,
        startTime: metadata.startTime,
        endTime: metadata.endTime,
      },
      costAssumptions: {
        commission: Number(config.commission ?? 0.0003),
        slippage: Number(config.slippage ?? 0.001),
      },
    },
    dataParams: {
      symbol: metadata.symbol,
      timeframe: metadata.timeframe,
      startTime: metadata.startTime,
      endTime: metadata.endTime,
      initialCash: Number(config.initialCash ?? 1000000),
      slippage: Number(config.slippage ?? 0.001),
    },
    returnMetrics: {
      cumulativeReturn: metrics.totalReturn,
      annualizedReturn: metrics.annualizedReturn,
      benchmarkReturn: 0,
      alpha: 0,
      beta: 0,
      trackingError: 0,
    },
    riskMetrics: {
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownDuration: null,
      annualizedVolatility: null,
      var95: null,
      var99: null,
      cvar95: null,
      skewness: null,
      kurtosis: null,
    },
    riskAdjMetrics: {
      sharpeRatio: metrics.sharpeRatio,
      sortinoRatio: null,
      calmarRatio: null,
      informationRatio: null,
    },
    tradeStats: {
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      profitLossRatio: null,
      avgHoldingDays: null,
      maxSingleProfit: null,
      maxSingleLoss: null,
      annualTurnover: null,
    },
    equityData: {
      equityCurve: (result.equityCurve as Array<{ timestamp: number; equity: number }>).map(p => ({
        timestamp: p.timestamp,
        equity: p.equity,
        drawdown: 0,
      })),
      monthlyReturns: [],
      annualReturns: [],
      drawdownSeries: [],
    },
    robustness: {
      paramSensitivity: [],
      rollingWindows: [],
      marketRegimes: [],
    },
    attribution: {
      brinsonAttribution: [],
      factorExposure: [],
    },
    issues: [],
    conclusion: {
      strengths: [],
      risks: [],
      improvements: [],
      liveSuggestions: [],
    },
    positionAnalysis: {
      avgPosition: 0,
      positionDistribution: [],
      positionVolatilityCorrelation: 0,
      positionChangeFrequency: 0,
    },
    subStrategyAttribution: {
      subStrategies: [],
      correlationMatrix: [],
    },
    stressTest: {
      scenarios: [],
    },
    costSensitivity: {
      costDrag: 0,
      sensitivityRange: [],
    },
    benchmarkComparison: {
      benchmarkName: '',
      comparisonMetrics: [],
    },
    riskWarnings: {
      keyRisks: [],
      redLines: [],
    },
  };
}
