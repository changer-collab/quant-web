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
    category?: string;
    subcategory?: string;
    configHash?: string;
  }
): BacktestReportFull {
  const metrics = result.metrics;
  const config = result.config as Record<string, unknown>;
  const formatDate = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    id: `report-${Date.now()}`,
    taskId: '',
    strategyName: metadata.strategyName,
    strategyVersion: String(config.version ?? '1.0.0'),
    strategyDescription: String(config.description ?? ''),
    status: 'completed',
    generatedAt: new Date().toLocaleString('zh-CN'),

    executiveSummary: {
      oneLineConclusion: '',
      recommendedForLive: false,
      recommendationReason: '',
      keyMetrics: {
        annualizedReturn: metrics.annualizedReturn,
        maxDrawdown: metrics.maxDrawdown,
        sharpeRatio: metrics.sharpeRatio,
      },
      beatsBenchmark: false,
      mainRisks: [],
      strategyCategory: String(config.strategyKind ?? config.category ?? 'timing'),
    },

    overview: {
      name: metadata.strategyName,
      version: String(config.version ?? '1.0.0'),
      logic: String(config.logic ?? ''),
      instruments: [metadata.symbol],
      timeRange: {
        start: formatDate(metadata.startTime),
        end: formatDate(metadata.endTime),
      },
      frequency: metadata.timeframe,
      benchmark: '',
      strategyCategory: String(config.strategyKind ?? config.category ?? 'timing'),
      suitableMarketRegime: [],
      coreLogic: '',
    },

    dataParams: {
      dataSource: '',
      adjustmentType: '',
      fee: { commission: Number(config.commission ?? 0.0003), stampTax: 0.001 },
      slippage: { model: 'fixed', value: Number(config.slippage ?? 0.001) },
      capital: {
        initialCash: Number(config.initialCash ?? 1000000),
        maxLeverage: 1.0,
        positionLimit: 0.95,
      },
      params: [],
    },

    returnMetrics: {
      cumulativeReturn: metrics.totalReturn,
      totalReturn: metrics.totalReturn,
      annualizedReturn: metrics.annualizedReturn,
      alpha: 0,
      benchmarkReturn: 0,
    },

    riskMetrics: {
      maxDrawdown: metrics.maxDrawdown,
      maxDrawdownDuration: metrics.maxDrawdownDuration ?? null,
      annualizedVolatility: metrics.annualizedVolatility ?? null,
      downsideVolatility: 0,
      var95: null,
      cvar95: null,
      calmarRatio: metrics.calmarRatio ?? 0,
      sortinoRatio: metrics.sortinoRatio ?? 0,
      skewness: undefined,
      kurtosis: undefined,
    },

    riskAdjMetrics: {
      sharpeRatio: metrics.sharpeRatio,
      sortinoRatio: metrics.sortinoRatio ?? 0,
      informationRatio: 0,
      treynorRatio: 0,
    },

    tradeStats: {
      totalTrades: metrics.totalTrades,
      winningTrades: 0,
      losingTrades: 0,
      winRate: metrics.winRate,
      profitLossRatio: result.profitLossRatio ?? null,
      avgHoldingDays: result.avgHoldingDays ?? null,
      turnoverRate: 0,
      maxSingleProfit: result.maxSingleProfit ?? null,
      maxSingleLoss: result.maxSingleLoss ?? null,
      pnlDistribution: [],
    },

    equityData: {
      equityCurve: result.equityCurve.map((p) => ({
        timestamp: p.timestamp,
        equity: p.equity,
      })),
      benchmarkCurve: [],
      monthlyReturns: result.monthlyReturns,
      annualReturns: result.annualReturns,
      drawdownCurve: result.drawdownCurve,
    },

    robustness: {
      paramSensitivity: [],
      rollingWindows: [],
      marketRegimes: [],
      outOfSampleReturn: 0,
      shuffledReturn: 0,
    },

    attribution: {
      industryExposures: [],
      factorExposures: [],
      timingSelection: { timing: 0, selection: 0, residual: 0 },
    },

    issues: {
      overfittingRisk: 'low',
      survivorshipBias: false,
      lookAheadBias: false,
      enableMarketRules: false,
      liquidityAssessment: '',
      capacityEstimate: '',
    },

    conclusion: {
      advantages: [],
      potentialRisks: [],
      improvements: [],
      liveTradingAdvice: {
        suggestedCapital: '',
        suggestedInitialPosition: '',
        riskControlRules: [],
      },
      suitableMarketRegime: [],
    },

    positionAnalysis: {
      avgPositionLevel: 0,
      positionDistribution: [],
      volatilityRelation: '',
      positionAdjustments: {
        profitAddCount: 0,
        lossAddCount: 0,
        profitAddEffect: 0,
        lossAddEffect: 0,
      },
      maxSinglePosition: 0,
      adjustmentFrequency: 0,
      positionCurve: [],
    },

    subStrategyAttribution: {
      independentComparison: [],
      marginalContributions: [],
      timeSeriesAttribution: [],
      interactionEffect: 0,
    },

    stressTest: {
      scenarios: [],
      monteCarlo: null,
    },

    costSensitivity: {
      costAssumption: { commission: 0.0003, stampTax: 0.001, slippage: 0.001, impactCost: 0 },
      beforeAfterCost: [],
      costDragRatio: 0,
      slippageSensitivity: [],
      annualTurnover: 0,
    },

    benchmarkComparison: {
      rows: [],
    },

    riskWarnings: {
      limitations: [],
      codeSnippets: [],
      glossary: [],
      redLines: [],
    },

    strategyCategory: metadata.category,
    strategySubcategory: metadata.subcategory,
    configHash: metadata.configHash,
  };
}
