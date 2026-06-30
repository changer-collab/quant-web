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
  Diagnostics = 'diagnostics',
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
  taskId: string;
  strategyName: string;
  strategyVersion: string;
  strategyDescription: string;

  // 1. 策略概述
  overview: {
    name: string;
    version: string;
    logic: string;
    instruments: string[];
    timeRange: { start: string; end: string };
    frequency: string;
    benchmark: string;
    strategyCategory?: string;
    suitableMarketRegime?: string[];
    coreLogic?: string;
    composition?: Array<{ name: string; weight: number; description: string }>;
    keyParameters?: Array<{ name: string; value: string; description: string }>;
  };

  // 2. 数据与参数
  dataParams: {
    dataSource: string;
    adjustmentType: string;
    fee: { commission: number; stampTax: number };
    slippage: { model: string; value: number };
    capital: { initialCash: number; maxLeverage: number; positionLimit: number };
    params: { label: string; value: string }[];
  };

  // 3. 收益指标
  returnMetrics: {
    cumulativeReturn: number;
    totalReturn: number;
    annualizedReturn: number;
    alpha: number;
    benchmarkReturn: number;
  };

  // 4. 风险指标
  riskMetrics: {
    maxDrawdown: number;
    maxDrawdownDuration: number | null;
    annualizedVolatility: number | null;
    downsideVolatility: number;
    var95: number | null;
    cvar95: number | null;
    calmarRatio: number;
    sortinoRatio?: number;
    skewness?: number;
    kurtosis?: number;
  };

  // 5. 风险调整后收益
  riskAdjMetrics: {
    sharpeRatio: number;
    sortinoRatio: number;
    informationRatio: number;
    treynorRatio: number;
  };

  // 6. 交易统计
  tradeStats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    profitLossRatio: number | null;
    avgHoldingDays: number | null;
    turnoverRate: number;
    maxSingleProfit: number | null;
    maxSingleLoss: number | null;
    pnlDistribution: number[];
    maxConsecutiveWins?: number;
    maxConsecutiveLosses?: number;
    concentrationIndex?: number;
  };

  // 7. 资金曲线
  equityData: {
    equityCurve: Array<{ timestamp: number; equity: number }>;
    benchmarkCurve: Array<{ timestamp: number; equity: number }>;
    monthlyReturns: Array<{ year: number; month: number; return_pct: number }>;
    annualReturns: Array<{ year: number; return_pct: number }>;
    drawdownCurve: Array<{ timestamp: number; drawdown: number }>;
  };

  // 8. 稳健性检验
  robustness: {
    paramSensitivity: Array<{ paramName: string; values: number[]; returns: number[] }>;
    rollingWindows: Array<{ windowSize: number; returns: number[]; sharpeRatios: number[] }>;
    marketRegimes: Array<{ regime: string; startDate: number; endDate: number; return: number }>;
    outOfSampleReturn: number;
    shuffledReturn: number;
  };

  // 9. 风险归因
  attribution: {
    industryExposures: Array<{ industry: string; weight: number; contribution: number }>;
    factorExposures: Array<{ factor: string; exposure: number; contribution: number }>;
    timingSelection: { timing: number; selection: number; residual: number };
  };

  // 10. 潜在问题
  issues: {
    overfittingRisk: 'low' | 'medium' | 'high';
    survivorshipBias: boolean;
    lookAheadBias: boolean;
    enableMarketRules: boolean;
    liquidityAssessment: string;
    capacityEstimate: string;
  };

  // 11. 执行摘要
  executiveSummary: {
    oneLineConclusion: string;
    recommendedForLive: boolean;
    recommendationReason: string;
    keyMetrics: { annualizedReturn: number; maxDrawdown: number; sharpeRatio: number };
    beatsBenchmark: boolean;
    mainRisks: string[];
    strategyCategory: string;
  };

  // 12. 结论与建议
  conclusion: {
    advantages: string[];
    potentialRisks: string[];
    improvements: string[];
    liveTradingAdvice: {
      suggestedCapital: string;
      suggestedInitialPosition: string;
      riskControlRules: string[];
    };
    suitableMarketRegime: string[];
  };

  // 13. 仓位分析
  positionAnalysis: {
    avgPositionLevel: number;
    positionDistribution: Array<{ level: string; ratio: number }>;
    volatilityRelation: string;
    positionAdjustments: {
      profitAddCount: number;
      lossAddCount: number;
      profitAddEffect: number;
      lossAddEffect: number;
    };
    maxSinglePosition: number;
    adjustmentFrequency: number;
    positionCurve: Array<{ timestamp: number; position: number }>;
  };

  // 14. 子策略归因
  subStrategyAttribution: {
    independentComparison: Array<{
      name: string;
      annualizedReturn: number;
      annualizedVolatility: number;
      maxDrawdown: number;
      sharpe: number;
      description: string;
    }>;
    marginalContributions: Array<{ module: string; contribution: number }>;
    timeSeriesAttribution: Array<{
      period: string;
      contributions: Array<{ module: string; value: number }>;
      total: number;
    }>;
    interactionEffect: number;
  };

  // 15. 压力测试
  stressTest: {
    scenarios: Array<{
      name: string;
      period: string;
      strategyDrawdown: number;
      benchmarkDrawdown: number;
      recoveryDays: number;
      note: string;
    }>;
    monteCarlo: {
      simulatedPaths: number;
      medianReturn: number;
      percentile5: number;
      percentile95: number;
      probPositiveReturn: number;
    } | null;
  };

  // 16. 成本敏感性
  costSensitivity: {
    costAssumption: { commission: number; stampTax: number; slippage: number; impactCost: number };
    beforeAfterCost: Array<{ metric: string; beforeCost: number; afterCost: number }>;
    costDragRatio: number;
    slippageSensitivity: Array<{ slippageBp: number; annualizedReturn: number; sharpe: number }>;
    annualTurnover: number;
  };

  // 17. 基准比较
  benchmarkComparison: {
    rows: Array<{ metric: string; strategy: string; benchmark: string; excess: string }>;
  };

  // 18. 风险提示与附录
  riskWarnings: {
    limitations: Array<{ category: string; description: string }>;
    codeSnippets: Array<{ title: string; language: string; code: string }>;
    glossary: Array<{ term: string; definition: string }>;
    redLines: Array<{ rule: string; threshold: string; actual: string; passed: boolean }>;
  };

  status: string;
  generatedAt: string;
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

// ─── 策略分类类型 ─────────────────────────────────────────────────────

/** 策略分类（与 Python StrategyCategory 值对齐） */
export type StrategyCategory = 'factor_based' | 'non_factor' | 'transitional';

/** 策略子分类（与 Python StrategySubcategory 值对齐） */
export type StrategySubcategory =
  | 'linear_multi_factor'
  | 'nonlinear_ml'
  | 'trend_cta'
  | 'mean_reversion'
  | 'arbitrage'
  | 'high_frequency'
  | 'macro_quant'
  | 'event_driven'
  | 'e2e_ai_timeseries'
  | 'tail_risk_hedging';

/** 约束条件 */
export interface UIConstraint {
  kind: 'disable_when' | 'require_when' | 'set_default_when' | 'range_when';
  target_field: string;
  target_value: unknown;
  action_value?: unknown;
}

/** 策略参数定义 */
export interface StrategyParamDef {
  key: string;
  label: string;
  type: string;
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
  chart_relevant?: boolean;
  ui_constraints?: UIConstraint[];
}

/** 策略配置快照 */
export interface ConfigSnapshot {
  strategy: string;
  params: Record<string, unknown>;
}

/** 策略配置 */
export interface StrategyConfig {
  config_json: Record<string, unknown>;
  hash: string;
  updated_at: number;
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

// ─── 诊断结果类型 ─────────────────────────────────────────────────────

export interface DiagnosticResult {
  id: string;
  taskId: string;
  strategy: string;
  category: StrategyCategory;
  configSnapshot: ConfigSnapshot;
  dataJson: Record<string, unknown>;
  createdAt: number;
}
