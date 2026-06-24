import type {
  CreateResearchJobInput,
  CreateResearchReportInput,
  LanguageCode,
  ResearchJob,
  ResearchReport,
  BacktestReportFull,
  ReportConclusion,
  ReportRiskWarnings,
} from './types';
import { getContent, getResearchMode } from './accessors';
import { localizeJobState, localizeResearchJob } from './localization';

function resolveResearchTarget(input: CreateResearchJobInput, language?: LanguageCode) {
  const content = getContent(language);
  const mode = input.strategy?.mode ?? input.mode ?? 'traditional';
  const strategyName =
    input.strategy?.name ?? `${getResearchMode(mode, language).title}${content.draftSuffix} #${input.sequence}`;

  return { content, mode, strategyName };
}

export function createResearchJob(input: CreateResearchJobInput, language?: LanguageCode): ResearchJob {
  const { content, mode, strategyName } = resolveResearchTarget(input, language);

  return {
    id: input.id,
    name: `${content.runJobPrefix}${strategyName}`,
    kind: content.modeJobKind[mode],
    state: input.initialState ?? 'Running',
    progress: input.initialProgress ?? 0,
    strategyName,
    template: 'run',
    mode,
    strategyId: input.strategy?.id,
    sequence: input.sequence,
    configSummary: input.configSummary ? [...input.configSummary] : undefined,
  };
}

export function createResearchReport(input: CreateResearchReportInput, language?: LanguageCode): ResearchReport {
  const { content, mode, strategyName } = resolveResearchTarget(input, language);
  const labels = content.reportMetricLabels;
  const modeName = content.modeJobKind[mode];
  const metrics = input.strategy
    ? [
        { label: labels.return, value: input.strategy.return, tone: 'good' as const },
        { label: labels.drawdown, value: input.strategy.drawdown, tone: 'warn' as const },
        { label: labels.sharpe, value: input.strategy.sharpe, tone: 'good' as const },
        { label: labels.mode, value: modeName, tone: 'info' as const },
      ]
    : getResearchMode(mode, language).heroMetrics.map((metric) =>
        metric.label === labels.mode ? metric : { ...metric },
      );

  if (!input.strategy && !metrics.some((metric) => metric.label === labels.mode)) {
    metrics[0] = { label: labels.mode, value: modeName, tone: 'info' };
  }

  const diagnostics = getResearchMode(mode, language).sections.map((section) => ({
    title: section.title,
    items: [...section.items],
  }));

  if (input.configSummary?.length) {
    diagnostics.unshift({
      title: content.ui.runConfigurationTitle,
      items: [...input.configSummary],
    });
  }

  return {
    id: input.id,
    jobId: input.jobId,
    mode,
    modeName,
    strategyName,
    title: `${content.reportTitlePrefix}${strategyName}`,
    status: `${content.completedState} · ${input.generatedAt}`,
    generatedAt: input.generatedAt,
    metrics,
    diagnostics,
    configSummary: input.configSummary ? [...input.configSummary] : undefined,
  };
}

/** Python BacktestResult 结构（经 _to_camel 转换后的 camelCase） */
interface PythonBacktestResult {
  config: {
    strategyName?: string;
    instruments?: string[];
    timeframe?: string;
    startDate?: number;
    endDate?: number;
    initialCash?: number;
    slippage?: number;
    strategyKind?: string;
    params?: Record<string, unknown>;
  };
  trades?: unknown[];
  equityCurve?: { timestamp: number; equity: number }[];
  drawdownCurve?: { timestamp: number; drawdown: number }[];
  monthlyReturns?: { year: number; month: number; return_pct: number }[];
  annualReturns?: { year: number; return_pct: number }[];
  metrics?: {
    totalReturn?: number;
    annualizedReturn?: number;
    sharpeRatio?: number;
    maxDrawdown?: number;
    winRate?: number;
    totalTrades?: number;
  };
}

/** 时间戳转日期字符串 */
function tsToDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

/** 创建空白报告模板（不含 mock 数据，所有可选字段为空） */
function createEmptyReport(source?: Partial<BacktestReportFull>): BacktestReportFull {
  const src = source as Record<string, unknown> | undefined;
  const base: BacktestReportFull = {
    id: '',
    taskId: '',
    strategyName: '',
    strategyVersion: '',
    strategyDescription: '',
    status: 'completed',
    generatedAt: '',

    overview: {
      name: '',
      version: '',
      logic: '',
      instruments: [],
      timeRange: { start: '', end: '' },
      frequency: '',
      benchmark: '',
      strategyCategory: 'timing',
      suitableMarketRegime: [],
      coreLogic: '',
    },

    dataParams: {
      dataSource: '',
      adjustmentType: '',
      fee: { commission: 0, stampTax: 0 },
      slippage: { model: '', value: 0 },
      capital: { initialCash: 0, maxLeverage: 0, positionLimit: 0 },
      params: [],
    },

    returnMetrics: {
      cumulativeReturn: 0,
      totalReturn: 0,
      annualizedReturn: 0,
      alpha: 0,
      benchmarkReturn: 0,
    },

    riskMetrics: {
      maxDrawdown: 0,
      maxDrawdownDuration: 0,
      annualizedVolatility: 0,
      downsideVolatility: 0,
      var95: 0,
      cvar95: 0,
      calmarRatio: 0,
    },

    riskAdjMetrics: {
      sharpeRatio: 0,
      sortinoRatio: 0,
      informationRatio: 0,
      treynorRatio: 0,
    },

    tradeStats: {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      profitLossRatio: 0,
      avgHoldingDays: 0,
      turnoverRate: 0,
      maxSingleProfit: 0,
      maxSingleLoss: 0,
      pnlDistribution: [],
    },

    equityData: {
      equityCurve: [],
      benchmarkCurve: [],
      monthlyReturns: [],
      annualReturns: [],
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

    executiveSummary: {
      oneLineConclusion: '',
      recommendedForLive: false,
      recommendationReason: '',
      keyMetrics: { annualizedReturn: 0, maxDrawdown: 0, sharpeRatio: 0 },
      beatsBenchmark: false,
      mainRisks: [],
      strategyCategory: '',
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
      costAssumption: { commission: 0, stampTax: 0, slippage: 0, impactCost: 0 },
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
  };

  if (!src) return base;

  // 深度合并 src 到 base（只覆盖已存在的 key，避免引入 mock 字段）
  return {
    ...base,
    ...src,
    overview: { ...base.overview, ...(src.overview as Record<string, unknown>) },
    dataParams: { ...base.dataParams, ...(src.dataParams as Record<string, unknown>) },
    returnMetrics: { ...base.returnMetrics, ...(src.returnMetrics as Record<string, unknown>) },
    riskMetrics: { ...base.riskMetrics, ...(src.riskMetrics as Record<string, unknown>) },
    riskAdjMetrics: { ...base.riskAdjMetrics, ...(src.riskAdjMetrics as Record<string, unknown>) },
    tradeStats: { ...base.tradeStats, ...(src.tradeStats as Record<string, unknown>) },
    equityData: { ...base.equityData, ...(src.equityData as Record<string, unknown>) },
    robustness: { ...base.robustness, ...(src.robustness as Record<string, unknown>) },
    attribution: { ...base.attribution, ...(src.attribution as Record<string, unknown>) },
    issues: { ...base.issues, ...(src.issues as Record<string, unknown>) },
    executiveSummary: { ...base.executiveSummary, ...(src.executiveSummary as Record<string, unknown>) },
    conclusion: { ...base.conclusion, ...(src.conclusion as Record<string, unknown>) },
    positionAnalysis: { ...base.positionAnalysis, ...(src.positionAnalysis as Record<string, unknown>) },
    subStrategyAttribution: { ...base.subStrategyAttribution, ...(src.subStrategyAttribution as Record<string, unknown>) },
    stressTest: { ...base.stressTest, ...(src.stressTest as Record<string, unknown>) },
    costSensitivity: { ...base.costSensitivity, ...(src.costSensitivity as Record<string, unknown>) },
    benchmarkComparison: { ...base.benchmarkComparison, ...(src.benchmarkComparison as Record<string, unknown>) },
    riskWarnings: { ...base.riskWarnings, ...(src.riskWarnings as Record<string, unknown>) },
  } as BacktestReportFull;
}

/** 创建一个空白回测报告（不依赖 mock 数据） */
export function createBacktestReportFull(
  source?: Partial<BacktestReportFull>,
): BacktestReportFull {
  return createEmptyReport(source);
}

/** 将 Worker 返回的真实回测结果映射为 BacktestReportFull（未覆盖字段保持空） */
export function mapBacktestResultToReport(
  taskResult: { backtestResult?: unknown; analysis?: unknown } | undefined,
  source?: Partial<BacktestReportFull>,
): BacktestReportFull {
  const bt = taskResult?.backtestResult as PythonBacktestResult | undefined;
  const analysis = taskResult?.analysis as Record<string, unknown> | undefined;
  if (!bt) return createEmptyReport(source);

  const metrics = bt.metrics ?? {};
  const config = bt.config ?? {};

  const report = createEmptyReport({
    ...source,
    strategyName: config.strategyName ?? source?.strategyName ?? '',
    overview: {
      name: config.strategyName ?? source?.overview?.name ?? '',
      timeRange: {
        start: tsToDate(config.startDate ?? 0) || source?.overview?.timeRange.start || '',
        end: tsToDate(config.endDate ?? 0) || source?.overview?.timeRange.end || '',
      },
      frequency: config.timeframe ?? source?.overview?.frequency ?? '',
      strategyCategory: config.strategyKind ?? source?.overview?.strategyCategory ?? 'timing',
    },
    dataParams: {
      capital: {
        initialCash: config.initialCash ?? 0,
        maxLeverage: 1.0,
        positionLimit: 0.95,
      },
      slippage: { model: 'fixed', value: config.slippage ?? 0 },
    },
    returnMetrics: {
      cumulativeReturn: metrics.totalReturn ?? 0,
      totalReturn: metrics.totalReturn ?? 0,
      annualizedReturn: metrics.annualizedReturn ?? 0,
    },
    riskMetrics: {
      maxDrawdown: metrics.maxDrawdown ?? 0,
    },
    riskAdjMetrics: {
      sharpeRatio: metrics.sharpeRatio ?? 0,
    },
    tradeStats: {
      totalTrades: metrics.totalTrades ?? 0,
      winRate: metrics.winRate ?? 0,
    },
    executiveSummary: {
      keyMetrics: {
        annualizedReturn: metrics.annualizedReturn ?? 0,
        maxDrawdown: metrics.maxDrawdown ?? 0,
        sharpeRatio: metrics.sharpeRatio ?? 0,
      },
    },
    equityData: {
      equityCurve: (bt.equityCurve ?? []).map((p) => ({ timestamp: p.timestamp, equity: p.equity })),
      drawdownCurve: bt.drawdownCurve ?? [],
      monthlyReturns: bt.monthlyReturns ?? [],
      annualReturns: bt.annualReturns ?? [],
    },
  });

  // 合并 AI 分析结果（覆盖结论性字段）
  if (analysis) {
    const es = analysis.executiveSummary as Record<string, unknown> | undefined;
    if (es) {
      report.executiveSummary = {
        ...report.executiveSummary,
        oneLineConclusion: (es.oneLineConclusion as string) || report.executiveSummary.oneLineConclusion,
        recommendedForLive: (es.recommendedForLive as boolean) ?? report.executiveSummary.recommendedForLive,
        recommendationReason: (es.recommendationReason as string) || report.executiveSummary.recommendationReason,
        mainRisks: (es.mainRisks as string[]) ?? report.executiveSummary.mainRisks,
      };
    }
    const ov = analysis.overview as Record<string, unknown> | undefined;
    if (ov) {
      report.overview = {
        ...report.overview,
        logic: (ov.logic as string) || report.overview.logic,
        coreLogic: (ov.coreLogic as string) || report.overview.coreLogic,
        suitableMarketRegime: (ov.suitableMarketRegime as string[]) ?? report.overview.suitableMarketRegime,
      };
    }
    const iss = analysis.issues as Record<string, unknown> | undefined;
    if (iss) {
      report.issues = {
        ...report.issues,
        overfittingRisk: (iss.overfittingRisk as 'low' | 'medium' | 'high') ?? report.issues.overfittingRisk,
        liquidityAssessment: (iss.liquidityAssessment as string) || report.issues.liquidityAssessment,
        capacityEstimate: (iss.capacityEstimate as string) || report.issues.capacityEstimate,
      };
    }
    const con = analysis.conclusion as Record<string, unknown> | undefined;
    if (con) {
      report.conclusion = {
        ...report.conclusion,
        advantages: (con.advantages as string[]) ?? report.conclusion.advantages,
        potentialRisks: (con.potentialRisks as string[]) ?? report.conclusion.potentialRisks,
        improvements: (con.improvements as string[]) ?? report.conclusion.improvements,
        liveTradingAdvice: (con.liveTradingAdvice as ReportConclusion['liveTradingAdvice']) ?? report.conclusion.liveTradingAdvice,
      };
    }
    const rw = analysis.riskWarnings as Record<string, unknown> | undefined;
    if (rw) {
      report.riskWarnings = {
        ...report.riskWarnings,
        limitations: (rw.limitations as ReportRiskWarnings['limitations']) ?? report.riskWarnings.limitations,
        redLines: (rw.redLines as ReportRiskWarnings['redLines']) ?? report.riskWarnings.redLines,
      };
    }
  }

  return report;
}

export { localizeJobState, localizeResearchJob };
