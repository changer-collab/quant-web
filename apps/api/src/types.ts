/**
 * API 层内联类型定义
 * 核心逻辑已迁移到 Python 包，这些类型仅供 API 层使用
 */

/** 任务类型 */
export enum TaskType {
  Backtest = 'backtest',
  FactorCompute = 'factor_compute',
  FactorEval = 'factor_eval',
  AITrain = 'ai_train',
  Collect = 'collect',
}

/** 任务状态 */
export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

/** 研究模式 */
export enum ResearchMode {
  Traditional = 'traditional',
  Quantitative = 'quantitative',
  AiAssisted = 'ai_assisted',
}

/** 参数类型 */
export enum ParamType {
  Number = 'number',
  String = 'string',
  Boolean = 'boolean',
  Select = 'select',
}

/** 因子状态 */
export enum FactorStatus {
  Active = 'active',
  Deprecated = 'deprecated',
  Draft = 'draft',
}

/** 因子定义 */
export interface FactorDefinition {
  id: string;
  name: string;
  formula: string;
  category: string;
  modes: ResearchMode[];
  frequency: string;
  status: FactorStatus;
  version: string;
}

// ─── 回测报告类型（与 apps/web/src/data/types.ts 保持值对齐） ────────────

export interface BacktestReportFull {
  id: string;
  status: string;
  executiveSummary: {
    oneLineConclusion: string;
    recommendedForLive: boolean;
    keyMetrics: {
      annualizedReturn: number;
      maxDrawdown: number;
      sharpeRatio: number;
    };
    riskPoints: string[];
  };
  overview: {
    name: string;
    version: string;
    logic: string;
    strategyCategory: string;
    suitableMarketRegime: string[];
    dataRange: {
      symbol: string;
      timeframe: string;
      startTime?: number;
      endTime?: number;
    };
    costAssumptions: {
      commission: number;
      slippage: number;
    };
  };
  dataParams: {
    symbol: string;
    timeframe: string;
    startTime?: number;
    endTime?: number;
    initialCash: number;
    slippage: number;
  };
  returnMetrics: {
    cumulativeReturn: number;
    annualizedReturn: number;
    benchmarkReturn: number;
    alpha: number;
    beta: number;
    trackingError: number;
  };
  riskMetrics: {
    maxDrawdown: number;
    maxDrawdownDuration: number | null;
    annualizedVolatility: number | null;
    var95: number | null;
    var99: number | null;
    cvar95: number | null;
    skewness: number | null;
    kurtosis: number | null;
  };
  riskAdjMetrics: {
    sharpeRatio: number;
    sortinoRatio: number | null;
    calmarRatio: number | null;
    informationRatio: number | null;
  };
  tradeStats: {
    totalTrades: number;
    winRate: number;
    profitLossRatio: number | null;
    avgHoldingDays: number | null;
    maxSingleProfit: number | null;
    maxSingleLoss: number | null;
    annualTurnover: number | null;
  };
  equityData: {
    equityCurve: Array<{ timestamp: number; equity: number; drawdown: number }>;
    monthlyReturns: Array<{ year: number; month: number; return_pct: number }>;
    annualReturns: Array<{ year: number; return_pct: number }>;
    drawdownCurve: Array<{ timestamp: number; drawdown: number }>;
  };
  robustness: {
    paramSensitivity: Array<{ paramName: string; values: number[]; returns: number[] }>;
    rollingWindows: Array<{ windowSize: number; returns: number[]; sharpeRatios: number[] }>;
    marketRegimes: Array<{ regime: string; startDate: number; endDate: number; return: number }>;
  };
  attribution: {
    brinsonAttribution: Array<{ category: string; allocation: number; selection: number; total: number }>;
    factorExposure: Array<{ factor: string; exposure: number; contribution: number }>;
  };
  issues: Array<{ severity: string; message: string }>;
  conclusion: {
    strengths: string[];
    risks: string[];
    improvements: string[];
    liveSuggestions: string[];
  };
  positionAnalysis: {
    avgPosition: number;
    positionDistribution: Array<{ range: string; percentage: number }>;
    positionVolatilityCorrelation: number;
    positionChangeFrequency: number;
  };
  subStrategyAttribution: {
    subStrategies: Array<{ name: string; weight: number; return: number; contribution: number }>;
    correlationMatrix: Array<{ strategy1: string; strategy2: string; correlation: number }>;
  };
  stressTest: {
    scenarios: Array<{ name: string; return: number; maxDrawdown: number }>;
  };
  costSensitivity: {
    costDrag: number;
    sensitivityRange: Array<{ costMultiplier: number; netReturn: number }>;
  };
  benchmarkComparison: {
    benchmarkName: string;
    comparisonMetrics: Array<{ metric: string; strategy: number; benchmark: number; difference: number }>;
  };
  riskWarnings: {
    keyRisks: string[];
    redLines: string[];
  };
}

export interface BacktestReportSummary {
  id: string;
  taskId: string;
  strategyName: string;
  symbol: string;
  timeframe: string;
  startTime?: number;
  endTime?: number;
  createdAt: number;
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

export interface BacktestReport extends BacktestReportSummary {
  reportData: BacktestReportFull;
}

export interface ReportFilter {
  strategyName?: string;
  symbol?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
  offset?: number;
}

// ─── 因子评估类型 ─────────────────────────────────────────────────────

export interface FactorEvaluationSummary {
  id: string;
  factorId: string;
  taskId: string;
  createdAt: number;
  icMean?: number;
  icStd?: number;
  rankIcMean?: number;
  rankIcStd?: number;
  icir?: number;
  rankIcir?: number;
}

export interface FactorEvaluation extends FactorEvaluationSummary {
  groupReturns?: number[];
  evalData: Record<string, unknown>;
}

// ─── 回测结果类型（Worker 返回的原始结果） ──────────────────────────

export interface BacktestResult {
  config: Record<string, unknown>;
  trades: Array<Record<string, unknown>>;
  equityCurve: Array<{ timestamp: number; equity: number }>;
  metrics: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    /** 索提诺比率（下行偏差） */
    sortinoRatio: number;
    /** 卡玛比率（年化收益/最大回撤） */
    calmarRatio: number;
    /** 年化波动率 */
    annualizedVolatility: number;
    /** 最大回撤持续天数（从峰值到新高的最长天数） */
    maxDrawdownDuration: number;
  };
  /** 平均盈利/平均亏损 */
  profitLossRatio: number;
  /** 平均持仓天数 */
  avgHoldingDays: number;
  /** 单笔最大盈利 */
  maxSingleProfit: number;
  /** 单笔最大亏损 */
  maxSingleLoss: number;
  /** 回撤曲线（由 Python compute_drawdown_curve 计算） */
  drawdownCurve: Array<{ timestamp: number; drawdown: number }>;
  /** 月度收益（由 Python compute_period_returns 计算） */
  monthlyReturns: Array<{ year: number; month: number; return_pct: number }>;
  /** 年度收益（由 Python compute_period_returns 计算） */
  annualReturns: Array<{ year: number; return_pct: number }>;
}
