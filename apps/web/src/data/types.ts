/**
 * 因子状态
 */
export enum FactorStatus {
  Active = 'active',
  Deprecated = 'deprecated',
  Draft = 'draft',
}

/**
 * 因子评估器标签
 */
export enum FactorEvalTab {
  Sorting = 'sorting',
  ICAnalysis = 'icAnalysis',
  Regression = 'regression',
}

/** 时间周期（与 @quant/data-center TimeFrame 对齐） */
export enum TimeFrame {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  H1 = '1h',
  D1 = '1d',
}

/** 标的状态（与 @quant/data-center InstrumentStatus 对齐） */
export enum InstrumentStatus {
  Active = 'active',
  Suspended = 'suspended',
  Delisted = 'delisted',
}

/** 复权方向（与 @quant/data-center AdjustmentType 对齐） */
export enum AdjustmentType {
  Forward = 'forward',
  Backward = 'backward',
}

/** 报告期类型（与 @quant/data-center ReportType 对齐） */
export enum ReportType {
  Q1 = 'q1',
  Q2 = 'q2',
  Q3 = 'q3',
  Annual = 'annual',
}

/** 公告事件类型（与 @quant/data-center AnnouncementEventType 对齐） */
export enum AnnouncementEventType {
  ST = 'st',
  Suspended = 'suspended',
  Dividend = 'dividend',
  Restructure = 'restructure',
  IPO = 'ipo',
  Delist = 'delist',
  RightsIssue = 'rightsIssue',
}

/** 事件影响方向（与 @quant/data-center EventImpact 对齐） */
export enum EventImpact {
  Positive = 'positive',
  Neutral = 'neutral',
  Negative = 'negative',
  Unknown = 'unknown',
}

/** 宏观指标频率（与 @quant/data-center MacroFrequency 对齐） */
export enum MacroFrequency {
  Daily = 'daily',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Yearly = 'yearly',
}

/** 成交方向（与 @quant/data-center TradeSide 对齐） */
export enum TradeSide {
  Buy = 'buy',
  Sell = 'sell',
  Unknown = 'unknown',
}

/** 成交类型（与 @quant/data-center TradeType 对齐） */
export enum TradeType {
  Normal = 'normal',
  Block = 'block',
  Auction = 'auction',
}

/** 委托动作（与 @quant/data-center OrderAction 对齐） */
export enum OrderAction {
  Add = 'add',
  Cancel = 'cancel',
  Trade = 'trade',
}

/** L2 委托类型（与 @quant/data-center L2OrderType 对齐） */
export enum L2OrderType {
  Limit = 'limit',
  Market = 'market',
}

export type PageId =
  | 'dashboard'
  | 'strategies'
  | 'factor-lab'
  | 'workspace'
  | 'backtest'
  | 'experiments'
  | 'data'
  | 'jobs'
  | 'settings';

export type ResearchModeId = 'traditional' | 'hft' | 'ai';
export type MetricTone = 'good' | 'info' | 'warn';
export type LanguageCode = 'en' | 'zh';
export type JobTemplate = 'backtest' | 'train' | 'experiment' | 'run';

export interface NavItem {
  id: PageId;
  label: string;
  eyebrow: string;
}

export interface Metric {
  label: string;
  value: string;
  tone: MetricTone;
}

export interface PageSection {
  title: string;
  items: string[];
}

export interface PageContent {
  title: string;
  subtitle: string;
  status: string;
  heroMetrics: Metric[];
  sections: PageSection[];
}

export interface ResearchMode {
  id: ResearchModeId;
  label: string;
  title: string;
  description: string;
  codeFile: string;
  codeSample: string;
  configItems: ResearchConfigItem[];
  heroMetrics: Metric[];
  sections: PageSection[];
}

export interface AppState {
  activePage: PageId;
}

export interface StrategyParam {
  key: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'select';
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
}

export interface StrategyRow {
  id: string;
  mode: ResearchModeId;
  name: string;
  type: string;
  return: string;
  drawdown: string;
  sharpe: string;
  status: string;
  /** 策略描述（与 Python StrategyMeta.description 对齐） */
  description?: string;
  /** 策略版本（与 Python StrategyMeta.version 对齐） */
  version?: string;
  /** 策略类型标识（combined/select/timing/position/composite） */
  kind?: string;
  /** 可调参数定义（与 Python StrategyMeta.params 对齐） */
  params?: StrategyParam[];
}

export interface MarketTick {
  time: string;
  bid: string;
  ask: string;
  size: string;
  signal: string;
}

export interface ResearchConfigItem {
  label: string;
  value: string;
  description: string;
}

export type ResearchRunConfigSummary = string[];

export interface JobItem {
  name: string;
  kind: string;
  state: string;
  progress: number;
}

export interface ResearchJob extends JobItem {
  id: string;
  strategyName: string;
  template?: JobTemplate;
  mode?: ResearchModeId;
  strategyId?: string;
  sequence?: number;
  configSummary?: ResearchRunConfigSummary;
}

export interface ResearchReport {
  id: string;
  jobId: string;
  mode: ResearchModeId;
  modeName: string;
  strategyName: string;
  title: string;
  status: string;
  generatedAt: string;
  metrics: Metric[];
  diagnostics: PageSection[];
  configSummary?: ResearchRunConfigSummary;
}

export interface CreateResearchJobInput {
  id: string;
  sequence: number;
  mode?: ResearchModeId;
  strategy?: StrategyRow;
  configSummary?: ResearchRunConfigSummary;
  /** 初始状态（内部英文值，如 "Running"/"Completed"），默认 "Running" */
  initialState?: string;
  /** 初始进度（0-100），默认 0 */
  initialProgress?: number;
}

export interface CreateResearchReportInput extends CreateResearchJobInput {
  jobId: string;
  generatedAt: string;
}

/** 前端因子列表行（对应 @quant/factor-lab FactorRow，数值字段转为展示字符串） */
export interface FactorDisplayRow {
  id: string;
  name: string;
  category: string;
  description: string;
  ic: string;
  rankIc: string;
  groupReturn: string;
  layerReturn: string;
  referencedBy: string[];
  status: FactorStatus;
}

/** 前端因子评估结果（展示用，对应 @quant/factor-lab FactorEvaluationResult，数值字段转为展示字符串） */
export interface FactorEvalDisplayResult {
  factorId: string;
  factorName: string;
  activeTab: FactorEvalTab;
  icSeries: string[];
  groupReturns: { group: string; return: string }[];
  layerSummary: { layer: string; return: string; sharpe: string }[];
}

export interface UiCopy {
  aiDiagnosticsTitle: string;
  aiRiskStable: string;
  aiRiskWatch: string;
  aiTableHeaders: {
    featureSet: string;
    ic: string;
    rankIc: string;
    oosReturn: string;
    risk: string;
  };
  brandTagline: string;
  chartAriaLabel: string;
  currentResearchMode: string;
  enterWorkspace: string;
  heroEyebrow: string;
  languageDescription: string;
  languageTitle: string;
  modeTabsAriaLabel: string;
  navAriaLabel: string;
  currentRunSummary: string;
  ready: string;
  reportGeneratedAt: string;
  reportJob: string;
  reportMode: string;
  reportStrategy: string;
  runConfigurationTitle: string;
  reportSummaryTitle: string;
  runResearch: string;
  strategySample: string;
  strategyTableTitle: string;
  strategyTableHeaders: {
    strategy: string;
    type: string;
    return: string;
    drawdown: string;
    sharpe: string;
    status: string;
  };
  tickTableHeaders: {
    time: string;
    bid: string;
    ask: string;
    size: string;
    signal: string;
  };
  tickTableTitle: string;
  viewReport: string;
  workspaceAriaLabel: string;
  factorLabTitle: string;
  factorDefinitionTitle: string;
  factorBatchCalcTitle: string;
  factorEvalTitle: string;
  factorReferenceTitle: string;
  factorTableHeaders: {
    name: string;
    category: string;
    ic: string;
    rankIc: string;
    groupReturn: string;
    layerReturn: string;
    referencedBy: string;
    status: string;
  };
  /** 空状态占位文案 */
  emptyStrategies: string;
  emptyJobs: string;
  emptyFactors: string;
  /** 指标说明文案 */
  metricAnnotations: {
    returnAnnotation: string;
    drawdownAnnotation: string;
    sharpeAnnotation: string;
  };
  /** 状态标签 */
  failedState: string;
  queuedState: string;
  stableState: string;
  inResearchState: string;
  draftState: string;
  trainingState: string;
  /** 底部语境面板文案 */
  activityFeedTitle: string;
  activityFeedEmpty: string;
  backtestHistoryTitle: string;
  backtestHistoryEmpty: string;
  experimentTableTitle: string;
  experimentEmpty: string;
  dataCoverageTitle: string;
  dataCoverageFields: {
    instruments: string;
    tickSince: string;
    minuteCoverage: string;
    gaps: string;
    market: string;
    coverage: string;
    lastSync: string;
  };
  strategyGridModeLabels: {
    traditional: string;
    hft: string;
    ai: string;
  };
}

export interface LanguageContent {
  navItems: NavItem[];
  pages: Record<PageId, PageContent>;
  researchModes: ResearchMode[];
  strategies: StrategyRow[];
  marketTicks: MarketTick[];
  jobs: ResearchJob[];
  modeJobKind: Record<ResearchModeId, string>;
  reportMetricLabels: {
    return: string;
    drawdown: string;
    sharpe: string;
    mode: string;
  };
  ui: UiCopy;
  runningState: string;
  completedState: string;
  failedState: string;
  queuedState: string;
  reportTitlePrefix: string;
  runJobPrefix: string;
  draftSuffix: string;
  factors: FactorDisplayRow[];
  factorEvalResults: FactorEvalDisplayResult[];
  /** 因子评估报告（13 模块完整版） */
  factorReports: FactorReportFull[];
  /** 因子报告 UI 文案 */
  factorReportUiCopy: FactorReportUiCopy;
  /** 报告 UI 文案 */
  reportUiCopy: ReportUiCopy;
}

// ─── 回测报告类型（10 大模块） ──────────────────────────────

/** 策略概述 */
export interface ReportOverview {
  name: string;
  version: string;
  logic: string;
  instruments: string[];
  timeRange: { start: string; end: string };
  frequency: string;
  benchmark: string;
  /** 策略类型分类（select/timing/position/composite/portfolio） */
  strategyCategory?: string;
  /** 适用市场环境 */
  suitableMarketRegime?: string[];
  /** 策略核心逻辑说明（比 logic 更结构化） */
  coreLogic?: string;
  /** 组合策略构成（仅 composite/portfolio 类型） */
  composition?: Array<{
    name: string;
    weight: number;
    description: string;
  }>;
  /** 关键参数说明 */
  keyParameters?: Array<{
    name: string;
    value: string;
    description: string;
  }>;
}

/** 数据与参数 */
export interface ReportDataParams {
  dataSource: string;
  adjustmentType: string;
  fee: { commission: number; stampTax: number };
  slippage: { model: string; value: number };
  capital: { initialCash: number; maxLeverage: number; positionLimit: number };
  params: { label: string; value: string }[];
}

/** 收益指标 */
export interface ReportReturnMetrics {
  cumulativeReturn: number;
  totalReturn: number;
  annualizedReturn: number;
  alpha: number;
  benchmarkReturn: number;
}

/** 风险指标 */
export interface ReportRiskMetrics {
  maxDrawdown: number;
  maxDrawdownDuration: number;
  annualizedVolatility: number;
  downsideVolatility: number;
  var95: number;
  cvar95: number;
  calmarRatio: number;
  /** Sortino 比率 */
  sortinoRatio?: number;
  /** 收益偏度 */
  skewness?: number;
  /** 收益峰度 */
  kurtosis?: number;
}

/** 风险调整后收益 */
export interface ReportRiskAdjMetrics {
  sharpeRatio: number;
  sortinoRatio: number;
  informationRatio: number;
  treynorRatio: number;
}

/** 交易统计 */
export interface ReportTradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  profitLossRatio: number;
  avgHoldingDays: number;
  turnoverRate: number;
  maxSingleProfit: number;
  maxSingleLoss: number;
  /** 每笔交易盈亏百分比，用于盈亏分布直方图 */
  pnlDistribution: number[];
  /** 最大连续盈利次数 */
  maxConsecutiveWins?: number;
  /** 最大连续亏损次数 */
  maxConsecutiveLosses?: number;
  /** 持仓集中度（HHI 指数） */
  concentrationIndex?: number;
}

/** 资金曲线数据点 */
export interface EquityDataPoint {
  timestamp: number;
  equity: number;
}

/** 月度/年度收益 */
export interface MonthlyReturn {
  year: number;
  month: number;
  return_pct: number;
}

export interface AnnualReturn {
  year: number;
  return_pct: number;
}

/** 回撤曲线点 */
export interface DrawdownPoint {
  timestamp: number;
  drawdown: number;
}

/** 资金曲线模块 */
export interface ReportEquityData {
  equityCurve: EquityDataPoint[];
  benchmarkCurve: EquityDataPoint[];
  monthlyReturns: MonthlyReturn[];
  annualReturns: AnnualReturn[];
  drawdownCurve: DrawdownPoint[];
}

/** 参数敏感性 */
export interface ParamSensitivity {
  paramName: string;
  variations: { value: number; return: number; sharpe: number; drawdown: number }[];
}

/** 滚动回测窗口 */
export interface RollingWindowResult {
  start: string;
  end: string;
  return: number;
  sharpe: number;
  drawdown: number;
}

/** 市场环境 */
export interface MarketRegimeResult {
  regime: 'bull' | 'bear' | 'sideways';
  return: number;
  sharpe: number;
  drawdown: number;
  days: number;
}

/** 稳健性检验 */
export interface ReportRobustness {
  paramSensitivity: ParamSensitivity[];
  rollingWindows: RollingWindowResult[];
  marketRegimes: MarketRegimeResult[];
  outOfSampleReturn: number;
  shuffledReturn: number;
  /** Walk-forward 分析结果 */
  walkForward?: {
    windows: Array<{
      period: string;
      inSampleReturn: number;
      outOfSampleReturn: number;
      decay: number;
    }>;
    avgDecay: number;
  };
}

/** 行业暴露 */
export interface IndustryExposure {
  industry: string;
  weight: number;
  contribution: number;
}

/** 因子暴露 */
export interface FactorExposure {
  factor: string;
  exposure: number;
  contribution: number;
}

/** 择时 vs 选股 */
export interface TimingSelection {
  timing: number;
  selection: number;
  residual: number;
}

/** 风险归因 */
export interface ReportAttribution {
  industryExposures: IndustryExposure[];
  factorExposures: FactorExposure[];
  timingSelection: TimingSelection;
  /** Brinson 归因（选股/择时/交互） */
  brinsonAttribution?: {
    allocationEffect: number;
    selectionEffect: number;
    interactionEffect: number;
    totalActiveReturn: number;
  };
}

/** 潜在问题 */
export interface ReportIssues {
  overfittingRisk: 'low' | 'medium' | 'high';
  survivorshipBias: boolean;
  lookAheadBias: boolean;
  liquidityAssessment: string;
  capacityEstimate: string;
}

// ─── 回测报告扩展模块（基于 5 个回测报告框架） ──────────────

/** 执行摘要（框架3/4/5 要求：一页纸核心结论） */
export interface ReportExecutiveSummary {
  /** 一句话核心结论 */
  oneLineConclusion: string;
  /** 是否推荐实盘 */
  recommendedForLive: boolean;
  /** 推荐理由 */
  recommendationReason: string;
  /** 核心三指标（年化收益/最大回撤/夏普） */
  keyMetrics: {
    annualizedReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
  };
  /** 是否跑赢基准 */
  beatsBenchmark: boolean;
  /** 主要风险点 */
  mainRisks: string[];
  /** 策略类型标识（select/timing/position/composite/portfolio） */
  strategyCategory: string;
}

/** 结论与建议（框架1/2/3/4/5 要求） */
export interface ReportConclusion {
  /** 策略优势 */
  advantages: string[];
  /** 潜在风险 */
  potentialRisks: string[];
  /** 改进方向 */
  improvements: string[];
  /** 实盘建议 */
  liveTradingAdvice: {
    suggestedCapital: string;
    suggestedInitialPosition: string;
    riskControlRules: string[];
  };
  /** 适用市场环境 */
  suitableMarketRegime: string[];
}

/** 仓位分析（框架3 核心：仓位管理策略差异化部分） */
export interface ReportPositionAnalysis {
  /** 平均仓位水平 */
  avgPositionLevel: number;
  /** 仓位分布（空仓/轻仓/半仓/满仓时间占比） */
  positionDistribution: { level: string; ratio: number }[];
  /** 仓位与波动关系（高波动期是否降仓） */
  volatilityRelation: string;
  /** 加减仓行为统计 */
  positionAdjustments: {
    profitAddCount: number;
    lossAddCount: number;
    profitAddEffect: number;
    lossAddEffect: number;
  };
  /** 单标的仓位集中度 */
  maxSinglePosition: number;
  /** 仓位调整频率（天） */
  adjustmentFrequency: number;
  /** 仓位时序数据 */
  positionCurve: { timestamp: number; position: number }[];
}

/** 子策略归因（框架4/5 核心：组合策略归因） */
export interface ReportSubStrategyAttribution {
  /** 子策略独立回测对比 */
  independentComparison: {
    name: string;
    annualizedReturn: number;
    annualizedVolatility: number;
    maxDrawdown: number;
    sharpe: number;
    description: string;
  }[];
  /** 边际贡献分析 */
  marginalContributions: {
    module: string;
    contribution: number;
  }[];
  /** 时序归因（按季度） */
  timeSeriesAttribution: {
    period: string;
    contributions: { module: string; value: number }[];
    total: number;
  }[];
  /** 交互效应 */
  interactionEffect: number;
}

/** 压力测试（框架1/2/4 要求：极端市场情景） */
export interface ReportStressTest {
  /** 历史极端场景测试结果 */
  scenarios: {
    name: string;
    period: string;
    strategyDrawdown: number;
    benchmarkDrawdown: number;
    recoveryDays: number;
    note: string;
  }[];
  /** 蒙特卡洛模拟结果（无数据时为 null） */
  monteCarlo: {
    simulatedPaths: number;
    medianReturn: number;
    percentile5: number;
    percentile95: number;
    probPositiveReturn: number;
  } | null;
}

/** 成本敏感性分析（框架1/2/5 要求） */
export interface ReportCostSensitivity {
  /** 成本假设说明 */
  costAssumption: {
    commission: number;
    stampTax: number;
    slippage: number;
    impactCost: number;
  };
  /** 扣除成本前后对比 */
  beforeAfterCost: {
    metric: string;
    beforeCost: number;
    afterCost: number;
  }[];
  /** 成本占收益比例 */
  costDragRatio: number;
  /** 滑点敏感性 */
  slippageSensitivity: {
    slippageBp: number;
    annualizedReturn: number;
    sharpe: number;
  }[];
  /** 年化换手率 */
  annualTurnover: number;
}

/** 基准比较表（框架3 要求） */
export interface ReportBenchmarkComparison {
  /** 对比指标行 */
  rows: {
    metric: string;
    strategy: string;
    benchmark: string;
    excess: string;
  }[];
}

/** 风险提示与附录（框架1/5 要求） */
export interface ReportRiskWarnings {
  /** 不足与风险提示 */
  limitations: {
    category: string;
    description: string;
  }[];
  /** 关键代码片段 */
  codeSnippets: {
    title: string;
    language: string;
    code: string;
  }[];
  /** 术语表 */
  glossary: {
    term: string;
    definition: string;
  }[];
  /** 关键红线检查 */
  redLines: {
    rule: string;
    threshold: string;
    actual: string;
    passed: boolean;
  }[];
}

/** 完整回测报告（前端展示用） */
export interface BacktestReportFull {
  id: string;
  taskId: string;
  strategyName: string;
  strategyVersion: string;
  strategyDescription: string;

  // 1. 策略概述
  overview: ReportOverview;

  // 2. 数据与参数
  dataParams: ReportDataParams;

  // 3. 收益指标
  returnMetrics: ReportReturnMetrics;

  // 4. 风险指标
  riskMetrics: ReportRiskMetrics;

  // 5. 风险调整后收益
  riskAdjMetrics: ReportRiskAdjMetrics;

  // 6. 交易统计
  tradeStats: ReportTradeStats;

  // 7. 资金曲线
  equityData: ReportEquityData;

  // 8. 稳健性检验
  robustness: ReportRobustness;

  // 9. 风险归因
  attribution: ReportAttribution;

  // 10. 潜在问题
  issues: ReportIssues;

  // 11. 执行摘要
  executiveSummary: ReportExecutiveSummary;

  // 12. 结论与建议
  conclusion: ReportConclusion;

  // 13. 仓位分析
  positionAnalysis: ReportPositionAnalysis;

  // 14. 子策略归因
  subStrategyAttribution: ReportSubStrategyAttribution;

  // 15. 压力测试
  stressTest: ReportStressTest;

  // 16. 成本敏感性
  costSensitivity: ReportCostSensitivity;

  // 17. 基准比较
  benchmarkComparison: ReportBenchmarkComparison;

  // 18. 风险提示与附录
  riskWarnings: ReportRiskWarnings;

  status: string;
  generatedAt: string;
}

/** 报告 Tab ID */
export type ReportTabId =
  | 'overview'
  | 'dataParams'
  | 'returnMetrics'
  | 'riskMetrics'
  | 'riskAdjMetrics'
  | 'tradeStats'
  | 'equity'
  | 'robustness'
  | 'attribution'
  | 'issues'
  | 'executiveSummary'
  | 'conclusion'
  | 'positionAnalysis'
  | 'subStrategyAttribution'
  | 'stressTest'
  | 'costSensitivity'
  | 'benchmarkComparison'
  | 'riskWarnings';

/** 报告 UI 文案 */
export interface ReportUiCopy {
  overview: Record<string, string>;
  dataParams: Record<string, string>;
  returnMetrics: Record<string, string>;
  riskMetrics: Record<string, string>;
  riskAdj: Record<string, string>;
  tradeStats: Record<string, string>;
  equity: Record<string, string>;
  robustness: Record<string, string>;
  attribution: Record<string, string>;
  issues: Record<string, string>;
  executiveSummary: Record<string, string>;
  conclusion: Record<string, string>;
  positionAnalysis: Record<string, string>;
  subStrategyAttribution: Record<string, string>;
  stressTest: Record<string, string>;
  costSensitivity: Record<string, string>;
  benchmarkComparison: Record<string, string>;
  riskWarnings: Record<string, string>;
  tabs: Record<ReportTabId, string>;
  chartLabels: {
    annualizedReturn: string;
    maxDrawdown: string;
    sharpe: string;
    cumulativeReturn: string;
    annualizedVolatility: string;
    returnRate: string;
    var95: string;
    strategy: string;
    benchmark: string;
    excess: string;
    returnComparison: string;
    riskAdjReturn: string;
    backtestReport: string;
    switchReport: string;
    reportModules: string;
    noData: string;
    priceUp: string;
    priceDown: string;
  };
}

// ─── 因子评估报告类型（13 大模块） ──────────────────────────

/** 因子评级 */
export type FactorGrade = 'A' | 'B' | 'C' | 'D';

/** 模块1：因子基本信息 */
export interface FactorReportBasicInfo {
  name: string;
  category: string;
  dataSource: string;
  updateFrequency: string;
  formula: string;
  params: { label: string; value: string }[];
  processing: { standardization: string; winsorization: string; neutralization: string };
  version: string;
  reportDate: string;
  backtestRange: { start: string; end: string };
}

/** 模块2：描述性统计 */
export interface FactorReportDescriptiveStats {
  mean: number;
  std: number;
  median: number;
  percentiles: { p5: number; p25: number; p75: number; p95: number };
  skewness: number;
  kurtosis: number;
  missingRatio: number;
  coverage: number;
  coverageByCap: { cap: string; coverage: number }[];
  timeSeriesStability: number;
  distributionBins: { bin: string; count: number }[];
}

/** 模块3.1：分层回测 */
export interface FactorReportGroupBacktest {
  nGroups: number;
  groupAnnualReturns: { group: string; annualReturn: number }[];
  groupMetrics: { group: string; sharpe: number; maxDrawdown: number; winRate: number }[];
  longShortReturn: number;
  longShortSharpe: number;
  topExcessReturn: number;
  groupNavCurves: { group: string; points: { t: number; nav: number }[] }[];
  longShortNavCurve: { t: number; nav: number }[];
}

/** 模块3.2：IC 分析 */
export interface FactorReportICAnalysis {
  icMean: number;
  icStd: number;
  icWinRate: number;
  rankIcMean: number;
  rankIcStd: number;
  icSeries: { date: string; ic: number; rankIc: number }[];
  icCumulative: { date: string; cumIc: number }[];
  icDecay: { lag: string; ic: number }[];
  icMonthlyDistribution: { bin: string; count: number }[];
}

/** 模块3.3：回归分析 */
export interface FactorReportRegression {
  factorReturn: number;
  tStat: number;
  neweyWestT: number;
  grsStat: number | null;
  grsPValue: number | null;
  rSquared: number;
  factorReturnSeries: { date: string; ret: number }[];
}

/** 模块4：风险分析 */
export interface FactorReportRisk {
  factorVolatility: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
  negativeMonthRatio: number;
  regimePerformance: { regime: string; return: number; sharpe: number; drawdown: number }[];
  var95: number;
  cvar95: number;
  exposures: { factor: string; exposure: number }[];
}

/** 模块5：换手率&交易成本 */
export interface FactorReportTurnover {
  monthlyTurnover: number;
  quarterlyTurnover: number;
  singleSideTurnover: number;
  doubleSideTurnover: number;
  costSensitivity: { feeBps: number; navImpact: number }[];
  topHoldingOverlap: number;
}

/** 模块6：中性化&剥离 */
export interface FactorReportNeutralization {
  rawVsNeutralized: { metric: string; raw: number; neutralized: number }[];
  pureAlphaIc: { orthogonalTo: string; ic: number }[];
  redundancyMatrix: { factorA: string; factorB: string; correlation: number }[];
  vif: { factor: string; vif: number }[];
}

/** 模块7：分域表现 */
export interface FactorReportDomain {
  byCap: { cap: string; ic: number; groupReturn: number }[];
  byIndustry: { industry: string; ic: number; groupReturn: number }[];
  byRegime: { regime: string; ic: number; groupReturn: number }[];
  byValuation: { level: string; ic: number; groupReturn: number }[];
  byLiquidity: { level: string; ic: number; groupReturn: number }[];
  byBoard: { board: string; ic: number; groupReturn: number }[];
}

/** 模块8：相关性分析 */
export interface FactorReportCorrelation {
  correlationMatrix: { factorA: string; factorB: string; corr: number }[];
  returnCorrelation: { factorA: string; factorB: string; corr: number }[];
  clusters: { cluster: string; factors: string[] }[];
  pcaVariance: { component: string; variance: number; cumulative: number }[];
}

/** 模块9：多因子组合贡献 */
export interface FactorReportMultiFactor {
  weightInModel: number;
  marginalIcImprovement: number;
  marginalSharpeImprovement: number;
  interactionEffects: { withFactor: string; effect: number }[];
}

/** 模块10：经济逻辑 */
export interface FactorReportEconomicLogic {
  economicExplanation: string;
  literatureRefs: string[];
  aShareSpecific: string;
  dataSnoopingRisk: 'low' | 'medium' | 'high';
}

/** 模块11：稳健性检验 */
export interface FactorReportRobustness {
  paramSensitivity: { paramName: string; variations: { value: string; ic: number; groupReturn: number }[] }[];
  inSampleVsOutOfSample: { metric: string; inSample: number; outOfSample: number }[];
  benchmarkComparison: { benchmark: string; ic: number; groupReturn: number }[];
  weightingComparison: { method: string; ic: number; groupReturn: number }[];
  survivorshipBiasHandled: boolean;
}

/** 模块12：监控指标 */
export interface FactorReportMonitoring {
  realtimeIc: number;
  realtimeIcThreshold: number;
  coverage: number;
  coverageThreshold: number;
  directionReversalCount: number;
  directionReversalThreshold: number;
  extremeValueRatio: number;
  extremeValueThreshold: number;
  dataDelay: string;
  dataDelayThreshold: string;
  alerts: { metric: string; value: string; threshold: string; status: 'normal' | 'warning' | 'critical' }[];
}

/** 模块13：结论与建议 */
export interface FactorReportConclusion {
  grade: FactorGrade;
  gradeReason: string;
  recommendedScenarios: string[];
  riskWarnings: string[];
  nextActions: string[];
}

/** 因子报告 Tab ID */
export type FactorReportTabId =
  | 'basicInfo'
  | 'descriptiveStats'
  | 'effectiveness'
  | 'riskAnalysis'
  | 'turnoverCost'
  | 'neutralization'
  | 'domainAnalysis'
  | 'correlation'
  | 'multiFactor'
  | 'economicLogic'
  | 'robustness'
  | 'monitoring'
  | 'conclusion';

/** 完整因子评估报告 */
export interface FactorReportFull {
  id: string;
  factorId: string;
  factorName: string;
  generatedAt: string;
  basicInfo: FactorReportBasicInfo;
  descriptiveStats: FactorReportDescriptiveStats;
  groupBacktest: FactorReportGroupBacktest;
  icAnalysis: FactorReportICAnalysis;
  regression: FactorReportRegression;
  risk: FactorReportRisk;
  turnover: FactorReportTurnover;
  neutralization: FactorReportNeutralization;
  domain: FactorReportDomain;
  correlation: FactorReportCorrelation;
  multiFactor: FactorReportMultiFactor;
  economicLogic: FactorReportEconomicLogic;
  robustness: FactorReportRobustness;
  monitoring: FactorReportMonitoring;
  conclusion: FactorReportConclusion;
}

/** 因子报告 UI 文案 */
export interface FactorReportUiCopy {
  tabs: Record<FactorReportTabId, string>;
  basicInfo: Record<string, string>;
  descriptiveStats: Record<string, string>;
  effectiveness: Record<string, string>;
  riskAnalysis: Record<string, string>;
  turnoverCost: Record<string, string>;
  neutralization: Record<string, string>;
  domainAnalysis: Record<string, string>;
  correlation: Record<string, string>;
  multiFactor: Record<string, string>;
  economicLogic: Record<string, string>;
  robustness: Record<string, string>;
  monitoring: Record<string, string>;
  conclusion: Record<string, string>;
}
