import type { BacktestReportFull } from '../types';

function generateEquityCurve(
  length: number,
  startTimestamp: number,
  startEquity: number,
  totalReturn: number
): { timestamp: number; equity: number }[] {
  return Array.from({ length }, (_, i) => ({
    timestamp: startTimestamp + i * 86400000,
    equity: startEquity * (1 + ((i + 1) / length) * totalReturn),
  }));
}

function generateDrawdownCurve(
  curve: { timestamp: number; equity: number }[]
): { timestamp: number; drawdown: number }[] {
  let peak = curve[0]?.equity ?? 1_000_000;
  return curve.map((p) => {
    if (p.equity > peak) peak = p.equity;
    return { timestamp: p.timestamp, drawdown: (peak - p.equity) / peak };
  });
}

const START_TS = new Date('2023-01-01').getTime();
const EQUITY_LENGTH = 480;

export const MOCK_REPORT = {
  id: 'report-001',
  taskId: 'task-001',
  strategyName: '双均线交叉策略',
  strategyVersion: '1.0.0',
  strategyDescription: '双均线交叉策略，通过快慢均线交叉产生买卖信号',

  overview: {
    name: '双均线交叉策略',
    version: '1.0.0',
    logic: '当短期均线（MA5）上穿长期均线（MA20）时买入，下穿时卖出',
    instruments: ['000300.SH (沪深300)'],
    timeRange: { start: '2023-01-01', end: '2024-12-31' },
    frequency: '日频 (1d)',
    benchmark: '沪深300',
    strategyCategory: 'timing',
    suitableMarketRegime: ['趋势市', '弱震荡市'],
    coreLogic: '基于 5/20 双均线交叉产生多空信号，趋势确立时满仓，信号反转时空仓或反手。',
    keyParameters: [
      { name: 'fastPeriod', value: '5', description: '快线周期' },
      { name: 'slowPeriod', value: '20', description: '慢线周期' },
      { name: 'stopLoss', value: '0.05', description: '止损比例' },
    ],
  },

  dataParams: {
    dataSource: 'AKShare / 后复权日线数据',
    adjustmentType: '前复权',
    fee: { commission: 0.03, stampTax: 0.1 },
    slippage: { model: '固定滑点', value: 0.01 },
    capital: { initialCash: 1_000_000, maxLeverage: 1.0, positionLimit: 0.95 },
    params: [
      { label: '快线周期', value: '5' },
      { label: '慢线周期', value: '20' },
      { label: '滑点', value: '0.01%' },
    ],
  },

  returnMetrics: {
    cumulativeReturn: 0.156,
    totalReturn: 0.156,
    annualizedReturn: 0.132,
    alpha: 0.065,
    benchmarkReturn: 0.045,
  },

  riskMetrics: {
    maxDrawdown: 0.082,
    maxDrawdownDuration: 45,
    annualizedVolatility: 0.185,
    downsideVolatility: 0.112,
    var95: -0.023,
    cvar95: -0.038,
    calmarRatio: 1.61,
    sortinoRatio: 1.42,
    skewness: -0.32,
    kurtosis: 4.15,
  },

  riskAdjMetrics: {
    sharpeRatio: 0.98,
    sortinoRatio: 1.62,
    informationRatio: 0.72,
    treynorRatio: 0.15,
  },

  tradeStats: {
    totalTrades: 24,
    winningTrades: 14,
    losingTrades: 10,
    winRate: 0.583,
    profitLossRatio: 1.85,
    avgHoldingDays: 18,
    turnoverRate: 0.35,
    maxSingleProfit: 85000,
    maxSingleLoss: -42000,
    pnlDistribution: [
      8.5, 5.2, 3.1, 2.8, 2.1, 1.9, 1.5, 1.2, 0.8, 0.5, 0.3, 0.1, -0.2, -0.5, -0.8, -1.2, -1.8,
      -2.5, -3.2, -4.2, 6.3, 4.1, -1.5, 3.7,
    ],
    maxConsecutiveWins: 7,
    maxConsecutiveLosses: 4,
    concentrationIndex: 0.45,
  },

  equityData: {
    equityCurve: generateEquityCurve(EQUITY_LENGTH, START_TS, 1_000_000, 0.156),
    benchmarkCurve: generateEquityCurve(EQUITY_LENGTH, START_TS, 1_000_000, 0.045),
    monthlyReturns: [
      { year: 2023, month: 1, return_pct: 2.1 },
      { year: 2023, month: 2, return_pct: -1.3 },
      { year: 2023, month: 3, return_pct: 3.5 },
      { year: 2023, month: 4, return_pct: -0.8 },
      { year: 2023, month: 5, return_pct: 1.2 },
      { year: 2023, month: 6, return_pct: -2.4 },
      { year: 2023, month: 7, return_pct: 4.1 },
      { year: 2023, month: 8, return_pct: -1.9 },
      { year: 2023, month: 9, return_pct: 0.6 },
      { year: 2023, month: 10, return_pct: 2.8 },
      { year: 2023, month: 11, return_pct: -0.5 },
      { year: 2023, month: 12, return_pct: 1.7 },
      { year: 2024, month: 1, return_pct: 3.2 },
      { year: 2024, month: 2, return_pct: -2.1 },
      { year: 2024, month: 3, return_pct: 1.8 },
      { year: 2024, month: 4, return_pct: -0.9 },
      { year: 2024, month: 5, return_pct: 2.5 },
      { year: 2024, month: 6, return_pct: -1.5 },
      { year: 2024, month: 7, return_pct: 0.9 },
      { year: 2024, month: 8, return_pct: 3.8 },
      { year: 2024, month: 9, return_pct: -2.8 },
      { year: 2024, month: 10, return_pct: 1.4 },
      { year: 2024, month: 11, return_pct: -0.3 },
      { year: 2024, month: 12, return_pct: 2.2 },
    ],
    annualReturns: [
      { year: 2023, return_pct: 8.5 },
      { year: 2024, return_pct: 7.1 },
    ],
    drawdownCurve: [],
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
    liquidityAssessment: '',
    capacityEstimate: '',
  },
  status: 'completed',
  generatedAt: '',
} as unknown as BacktestReportFull;

// 回撤曲线基于净值曲线生成
const eqCurve = generateEquityCurve(EQUITY_LENGTH, START_TS, 1_000_000, 0.156);
const benchCurve = generateEquityCurve(EQUITY_LENGTH, START_TS, 1_000_000, 0.045);
MOCK_REPORT.equityData.equityCurve = eqCurve;
MOCK_REPORT.equityData.benchmarkCurve = benchCurve;
MOCK_REPORT.equityData.drawdownCurve = generateDrawdownCurve(eqCurve);

// 稳健性检验
const pSensitivity = [
  {
    paramName: '快线周期',
    variations: [
      { value: 3, return: 0.12, sharpe: 0.85, drawdown: 0.095 },
      { value: 5, return: 0.156, sharpe: 0.98, drawdown: 0.082 },
      { value: 10, return: 0.11, sharpe: 0.78, drawdown: 0.09 },
      { value: 15, return: 0.09, sharpe: 0.65, drawdown: 0.105 },
      { value: 20, return: 0.07, sharpe: 0.52, drawdown: 0.11 },
    ],
  },
  {
    paramName: '慢线周期',
    variations: [
      { value: 10, return: 0.1, sharpe: 0.72, drawdown: 0.095 },
      { value: 15, return: 0.13, sharpe: 0.88, drawdown: 0.087 },
      { value: 20, return: 0.156, sharpe: 0.98, drawdown: 0.082 },
      { value: 30, return: 0.14, sharpe: 0.85, drawdown: 0.078 },
      { value: 60, return: 0.1, sharpe: 0.7, drawdown: 0.09 },
    ],
  },
  {
    paramName: '滑点(bp)',
    variations: [
      { value: 0, return: 0.18, sharpe: 1.12, drawdown: 0.075 },
      { value: 1, return: 0.156, sharpe: 0.98, drawdown: 0.082 },
      { value: 3, return: 0.12, sharpe: 0.78, drawdown: 0.09 },
      { value: 5, return: 0.08, sharpe: 0.55, drawdown: 0.105 },
      { value: 10, return: 0.02, sharpe: 0.15, drawdown: 0.13 },
    ],
  },
];

const rWindows = [
  { start: '2023-01', end: '2023-06', return: 0.042, sharpe: 0.85, drawdown: 0.035 },
  { start: '2023-02', end: '2023-07', return: 0.031, sharpe: 0.72, drawdown: 0.04 },
  { start: '2023-03', end: '2023-08', return: 0.025, sharpe: 0.62, drawdown: 0.05 },
  { start: '2023-04', end: '2023-09', return: 0.038, sharpe: 0.78, drawdown: 0.045 },
  { start: '2023-05', end: '2023-10', return: 0.05, sharpe: 0.92, drawdown: 0.038 },
  { start: '2023-06', end: '2023-11', return: 0.028, sharpe: 0.65, drawdown: 0.048 },
  { start: '2023-07', end: '2023-12', return: 0.035, sharpe: 0.75, drawdown: 0.042 },
  { start: '2023-08', end: '2024-01', return: 0.022, sharpe: 0.55, drawdown: 0.055 },
  { start: '2023-09', end: '2024-02', return: 0.04, sharpe: 0.82, drawdown: 0.04 },
  { start: '2023-10', end: '2024-03', return: 0.045, sharpe: 0.88, drawdown: 0.036 },
  { start: '2023-11', end: '2024-04', return: 0.033, sharpe: 0.7, drawdown: 0.046 },
  { start: '2023-12', end: '2024-05', return: 0.029, sharpe: 0.64, drawdown: 0.05 },
  { start: '2024-01', end: '2024-06', return: 0.048, sharpe: 0.9, drawdown: 0.035 },
  { start: '2024-02', end: '2024-07', return: 0.036, sharpe: 0.76, drawdown: 0.042 },
  { start: '2024-03', end: '2024-08', return: 0.041, sharpe: 0.8, drawdown: 0.038 },
  { start: '2024-04', end: '2024-09', return: 0.034, sharpe: 0.72, drawdown: 0.044 },
  { start: '2024-05', end: '2024-10', return: 0.039, sharpe: 0.78, drawdown: 0.04 },
  { start: '2024-06', end: '2024-11', return: 0.044, sharpe: 0.85, drawdown: 0.037 },
  { start: '2024-07', end: '2024-12', return: 0.05, sharpe: 0.92, drawdown: 0.032 },
];

const mRegimes = [
  { regime: 'bull' as const, return: 0.12, sharpe: 1.5, drawdown: 0.03, days: 180 },
  { regime: 'bear' as const, return: -0.02, sharpe: -0.3, drawdown: 0.08, days: 120 },
  { regime: 'sideways' as const, return: 0.056, sharpe: 0.9, drawdown: 0.04, days: 180 },
];

MOCK_REPORT.robustness = {
  paramSensitivity: pSensitivity,
  rollingWindows: rWindows,
  marketRegimes: mRegimes,
  outOfSampleReturn: 0.085,
  shuffledReturn: 0.012,
  walkForward: {
    windows: [
      { period: '2020-2021', inSampleReturn: 0.18, outOfSampleReturn: 0.14, decay: 0.22 },
      { period: '2021-2022', inSampleReturn: 0.16, outOfSampleReturn: 0.13, decay: 0.19 },
      { period: '2022-2023', inSampleReturn: 0.15, outOfSampleReturn: 0.12, decay: 0.2 },
    ],
    avgDecay: 0.2,
  },
};

MOCK_REPORT.attribution = {
  industryExposures: [
    { industry: '金融', weight: 0.25, contribution: 0.032 },
    { industry: '科技', weight: 0.2, contribution: 0.045 },
    { industry: '消费', weight: 0.18, contribution: 0.028 },
    { industry: '医药', weight: 0.15, contribution: 0.018 },
    { industry: '制造业', weight: 0.12, contribution: 0.015 },
    { industry: '其他', weight: 0.1, contribution: 0.018 },
  ],
  factorExposures: [
    { factor: 'Size (市值)', exposure: -0.15, contribution: 0.012 },
    { factor: 'Value (价值)', exposure: 0.22, contribution: 0.025 },
    { factor: 'Momentum (动量)', exposure: 0.35, contribution: 0.048 },
    { factor: 'Volatility (波动)', exposure: -0.08, contribution: 0.005 },
  ],
  timingSelection: { timing: 0.032, selection: 0.098, residual: 0.026 },
  brinsonAttribution: {
    allocationEffect: 0.025,
    selectionEffect: 0.018,
    interactionEffect: 0.004,
    totalActiveReturn: 0.047,
  },
};

MOCK_REPORT.issues = {
  overfittingRisk: 'low',
  survivorshipBias: false,
  lookAheadBias: false,
  liquidityAssessment: '沪深300成分股流动性充裕，回测价格可执行',
  capacityEstimate: '基于日均换手率估算，策略容量约 2-5 亿元',
};

// 11. 执行摘要
MOCK_REPORT.executiveSummary = {
  oneLineConclusion:
    '双均线交叉策略在 2023-2024 年回测中实现 13.2% 年化收益，最大回撤 8.2%，夏普比率 0.98，跑赢沪深300 基准',
  recommendedForLive: true,
  recommendationReason: '策略回撤可控，参数敏感性稳定，样本外表现衰减小于 20%，建议小资金实盘验证',
  keyMetrics: {
    annualizedReturn: 0.132,
    maxDrawdown: 0.082,
    sharpeRatio: 0.98,
  },
  beatsBenchmark: true,
  mainRisks: ['震荡市中信号频繁失效', '2018 类熊市环境下可能跑输基准'],
  strategyCategory: 'timing',
};

// 12. 结论与建议
MOCK_REPORT.conclusion = {
  advantages: [
    '牛市中稳定跑赢基准，趋势跟踪能力强',
    '最大回撤 8.2%，低于基准的 12%',
    '参数敏感性稳定，快线 3-10 区间内夏普均 > 0.7',
  ],
  potentialRisks: [
    '震荡市中频繁发出错误信号，2018 类熊市可能跑输',
    '均线策略存在固有滞后性，趋势反转时回撤较大',
    '交易成本敏感，滑点从 1bp 升至 10bp 时收益从 15.6% 降至 2%',
  ],
  improvements: [
    '引入波动率过滤，在低波动震荡市减少信号',
    '加入 ATR 动态止损，控制单笔回撤',
    '扩展至多标的组合，降低单一标的集中风险',
  ],
  liveTradingAdvice: {
    suggestedCapital: '≥ 100 万（保证流动性）',
    suggestedInitialPosition: '建议从 50% 仓位开始，观察 1 个月',
    riskControlRules: ['单日回撤超过 3% 暂停交易', '个股权重上限 10%', '行业权重上限 30%'],
  },
  suitableMarketRegime: ['牛市', '趋势行情'],
};

// 13. 仓位分析
const positionCurve = eqCurve.map((p, i) => ({
  timestamp: p.timestamp,
  position: Math.max(0, Math.min(1, 0.5 + 0.4 * Math.sin(i / 30) + (i % 10) * 0.01)),
}));

MOCK_REPORT.positionAnalysis = {
  avgPositionLevel: 0.68,
  positionDistribution: [
    { level: '空仓 (0-10%)', ratio: 0.08 },
    { level: '轻仓 (10-40%)', ratio: 0.22 },
    { level: '半仓 (40-70%)', ratio: 0.35 },
    { level: '满仓 (70-100%)', ratio: 0.35 },
  ],
  volatilityRelation: '高波动期仓位自动降至 45%，低波动期维持 75%',
  positionAdjustments: {
    profitAddCount: 8,
    lossAddCount: 3,
    profitAddEffect: 0.025,
    lossAddEffect: -0.012,
  },
  maxSinglePosition: 0.85,
  adjustmentFrequency: 12,
  positionCurve,
};

// 14. 子策略归因
MOCK_REPORT.subStrategyAttribution = {
  independentComparison: [
    {
      name: '仅择股',
      annualizedReturn: 0.085,
      annualizedVolatility: 0.16,
      maxDrawdown: 0.09,
      sharpe: 0.53,
      description: '满仓等权',
    },
    {
      name: '仅择时',
      annualizedReturn: 0.105,
      annualizedVolatility: 0.18,
      maxDrawdown: 0.085,
      sharpe: 0.58,
      description: '全市场等权',
    },
    {
      name: '择股+择时',
      annualizedReturn: 0.132,
      annualizedVolatility: 0.185,
      maxDrawdown: 0.082,
      sharpe: 0.98,
      description: '完整组合',
    },
  ],
  marginalContributions: [
    { module: '择股贡献', contribution: 0.047 },
    { module: '择时贡献', contribution: 0.032 },
    { module: '交互效应', contribution: 0.053 },
  ],
  timeSeriesAttribution: [
    {
      period: '2023Q1',
      contributions: [
        { module: '择股', value: 0.015 },
        { module: '择时', value: 0.008 },
        { module: '交互', value: 0.005 },
      ],
      total: 0.028,
    },
    {
      period: '2023Q2',
      contributions: [
        { module: '择股', value: 0.012 },
        { module: '择时', value: -0.005 },
        { module: '交互', value: 0.003 },
      ],
      total: 0.01,
    },
    {
      period: '2023Q3',
      contributions: [
        { module: '择股', value: 0.018 },
        { module: '择时', value: 0.012 },
        { module: '交互', value: 0.006 },
      ],
      total: 0.036,
    },
    {
      period: '2023Q4',
      contributions: [
        { module: '择股', value: 0.01 },
        { module: '择时', value: 0.006 },
        { module: '交互', value: 0.002 },
      ],
      total: 0.018,
    },
  ],
  interactionEffect: 0.053,
};

// 15. 压力测试
MOCK_REPORT.stressTest = {
  scenarios: [
    {
      name: '2015 股灾',
      period: '2015-06 ~ 2015-08',
      strategyDrawdown: 0.065,
      benchmarkDrawdown: 0.42,
      recoveryDays: 35,
      note: '择时模块有效规避大部分回撤',
    },
    {
      name: '2018 贸易战',
      period: '2018-01 ~ 2018-12',
      strategyDrawdown: 0.092,
      benchmarkDrawdown: 0.25,
      recoveryDays: 68,
      note: '震荡市信号频繁失效',
    },
    {
      name: '2020 疫情',
      period: '2020-02 ~ 2020-03',
      strategyDrawdown: 0.038,
      benchmarkDrawdown: 0.16,
      recoveryDays: 18,
      note: '快速恢复',
    },
    {
      name: '2022 持续下跌',
      period: '2022-01 ~ 2022-04',
      strategyDrawdown: 0.071,
      benchmarkDrawdown: 0.2,
      recoveryDays: 45,
      note: '中等回撤',
    },
  ],
  monteCarlo: {
    simulatedPaths: 1000,
    medianReturn: 0.128,
    percentile5: 0.045,
    percentile95: 0.215,
    probPositiveReturn: 0.92,
  },
};

// 16. 成本敏感性
MOCK_REPORT.costSensitivity = {
  costAssumption: {
    commission: 0.03,
    stampTax: 0.1,
    slippage: 1,
    impactCost: 5,
  },
  beforeAfterCost: [
    { metric: '年化收益', beforeCost: 0.168, afterCost: 0.132 },
    { metric: '夏普比率', beforeCost: 1.18, afterCost: 0.98 },
    { metric: '最大回撤', beforeCost: 0.078, afterCost: 0.082 },
  ],
  costDragRatio: 0.21,
  slippageSensitivity: [
    { slippageBp: 0, annualizedReturn: 0.18, sharpe: 1.12 },
    { slippageBp: 1, annualizedReturn: 0.156, sharpe: 0.98 },
    { slippageBp: 3, annualizedReturn: 0.12, sharpe: 0.78 },
    { slippageBp: 5, annualizedReturn: 0.08, sharpe: 0.55 },
    { slippageBp: 10, annualizedReturn: 0.02, sharpe: 0.15 },
  ],
  annualTurnover: 8.4,
};

// 17. 基准比较
MOCK_REPORT.benchmarkComparison = {
  rows: [
    { metric: '年化收益', strategy: '13.2%', benchmark: '4.5%', excess: '+8.7%' },
    { metric: '年化波动', strategy: '18.5%', benchmark: '16.2%', excess: '+2.3%' },
    { metric: '夏普比率', strategy: '0.98', benchmark: '0.28', excess: '+0.70' },
    { metric: '最大回撤', strategy: '8.2%', benchmark: '12.0%', excess: '-3.8%' },
    { metric: '卡玛比率', strategy: '1.61', benchmark: '0.38', excess: '+1.23' },
    { metric: '胜率', strategy: '58.3%', benchmark: '—', excess: '—' },
  ],
};

// 18. 风险提示与附录
MOCK_REPORT.riskWarnings = {
  limitations: [
    { category: '数据质量', description: '前复权处理可能引入轻微前视偏差，停牌处理采用前值填充' },
    {
      category: '流动性假设',
      description: '假设按收盘价成交，大单冲击未完全建模，涨停板无法买入场景未处理',
    },
    {
      category: '过拟合风险',
      description: '参数优化自由度中等，快线/慢线组合数 25 种，需关注样本外衰减',
    },
    { category: '市场环境', description: '策略容量约 2-5 亿元，Regime Change 时可能失效' },
  ],
  codeSnippets: [
    {
      title: '双均线信号生成核心逻辑',
      language: 'python',
      code: 'def on_bar(self, bar):\n    fast_ma = self.fast_ma.update(bar.close)\n    slow_ma = self.slow_ma.update(bar.close)\n    if fast_ma > slow_ma and self.position <= 0:\n        self.buy(bar.symbol, bar.close, self.size)\n    elif fast_ma < slow_ma and self.position > 0:\n        self.sell(bar.symbol, bar.close, self.position)',
    },
  ],
  glossary: [
    {
      term: '夏普比率',
      definition: '(年化收益 - 无风险利率) / 年化波动率，衡量单位风险下的超额收益',
    },
    { term: '最大回撤', definition: '资金从峰值到谷底的最大跌幅，衡量最坏情况下的损失' },
    { term: '信息比率', definition: '超额收益均值 / 跟踪误差，衡量主动管理的风险调整收益' },
    {
      term: 'VaR',
      definition: '在给定置信度下的最大可能损失，如 95% VaR 表示有 95% 概率损失不超过此值',
    },
    { term: 'CVaR', definition: '条件在险价值，即损失超过 VaR 时的平均损失，衡量尾部风险' },
  ],
  redLines: [
    { rule: '最大回撤', threshold: '< 20%', actual: '8.2%', passed: true },
    { rule: '样本外衰减', threshold: '< 50%', actual: '35%', passed: true },
    { rule: '参数敏感性', threshold: '稳定', actual: '稳定', passed: true },
    { rule: '交易成本占比', threshold: '< 50%', actual: '21%', passed: true },
    { rule: '回测区间长度', threshold: '≥ 3 年', actual: '2 年', passed: false },
  ],
};

MOCK_REPORT.status = 'completed';
MOCK_REPORT.generatedAt = '2024-12-31 18:00:00';
