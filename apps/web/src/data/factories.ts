import type {
  CreateResearchJobInput,
  CreateResearchReportInput,
  LanguageCode,
  ResearchJob,
  ResearchReport,
  BacktestReportFull,
} from './types';
import { getContent, getResearchMode } from './accessors';
import { localizeJobState, localizeResearchJob } from './localization';
import { MOCK_REPORT } from './mock/report';

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

/** 创建一个模拟的完整回测报告 */
export function createBacktestReportFull(
  source?: Partial<BacktestReportFull>,
): BacktestReportFull {
  return {
    ...MOCK_REPORT,
    ...source,
    overview: { ...MOCK_REPORT.overview, ...source?.overview },
    dataParams: { ...MOCK_REPORT.dataParams, ...source?.dataParams },
    returnMetrics: { ...MOCK_REPORT.returnMetrics, ...source?.returnMetrics },
    riskMetrics: { ...MOCK_REPORT.riskMetrics, ...source?.riskMetrics },
    riskAdjMetrics: { ...MOCK_REPORT.riskAdjMetrics, ...source?.riskAdjMetrics },
    tradeStats: { ...MOCK_REPORT.tradeStats, ...source?.tradeStats },
    equityData: { ...MOCK_REPORT.equityData, ...source?.equityData },
    robustness: { ...MOCK_REPORT.robustness, ...source?.robustness },
    attribution: { ...MOCK_REPORT.attribution, ...source?.attribution },
    issues: { ...MOCK_REPORT.issues, ...source?.issues },
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

/** Worker 返回的 result 结构 */
interface WorkerTaskResult {
  taskId?: string;
  backtestResult?: PythonBacktestResult;
}

/** 时间戳转日期字符串 */
function tsToDate(ts: number): string {
  if (!ts) return '';
  return new Date(ts).toISOString().split('T')[0];
}

/** 将 Worker 返回的真实回测结果映射为 BacktestReportFull（未覆盖字段保持 mock） */
export function mapBacktestResultToReport(
  taskResult: { backtestResult?: unknown } | undefined,
  source?: Partial<BacktestReportFull>,
): BacktestReportFull {
  const bt = taskResult?.backtestResult as PythonBacktestResult | undefined;
  if (!bt) return createBacktestReportFull(source);

  const metrics = bt.metrics ?? {};
  const config = bt.config ?? {};

  return createBacktestReportFull({
    ...source,
    overview: {
      ...source?.overview,
      name: config.strategyName ?? source?.overview?.name ?? MOCK_REPORT.overview.name,
      version: source?.overview?.version ?? MOCK_REPORT.overview.version,
      logic: source?.overview?.logic ?? MOCK_REPORT.overview.logic,
      benchmark: source?.overview?.benchmark ?? MOCK_REPORT.overview.benchmark,
      instruments: config.instruments ?? source?.overview?.instruments ?? MOCK_REPORT.overview.instruments,
      timeRange: {
        start: tsToDate(config.startDate ?? 0) || source?.overview?.timeRange.start || MOCK_REPORT.overview.timeRange.start,
        end: tsToDate(config.endDate ?? 0) || source?.overview?.timeRange.end || MOCK_REPORT.overview.timeRange.end,
      },
      frequency: config.timeframe ?? source?.overview?.frequency ?? MOCK_REPORT.overview.frequency,
    },
    dataParams: {
      ...source?.dataParams,
      dataSource: source?.dataParams?.dataSource ?? MOCK_REPORT.dataParams.dataSource,
      adjustmentType: source?.dataParams?.adjustmentType ?? MOCK_REPORT.dataParams.adjustmentType,
      fee: { ...MOCK_REPORT.dataParams.fee, ...source?.dataParams?.fee },
      capital: {
        ...MOCK_REPORT.dataParams.capital,
        ...source?.dataParams?.capital,
        initialCash: config.initialCash ?? source?.dataParams?.capital?.initialCash ?? MOCK_REPORT.dataParams.capital.initialCash,
      },
      slippage: {
        ...MOCK_REPORT.dataParams.slippage,
        ...source?.dataParams?.slippage,
        value: config.slippage ?? source?.dataParams?.slippage?.value ?? MOCK_REPORT.dataParams.slippage.value,
      },
      params: source?.dataParams?.params ?? MOCK_REPORT.dataParams.params,
    },
    returnMetrics: {
      ...MOCK_REPORT.returnMetrics,
      ...source?.returnMetrics,
      totalReturn: metrics.totalReturn ?? source?.returnMetrics?.totalReturn ?? MOCK_REPORT.returnMetrics.totalReturn,
      annualizedReturn: metrics.annualizedReturn ?? source?.returnMetrics?.annualizedReturn ?? MOCK_REPORT.returnMetrics.annualizedReturn,
    },
    riskMetrics: {
      ...MOCK_REPORT.riskMetrics,
      ...source?.riskMetrics,
      maxDrawdown: metrics.maxDrawdown ?? source?.riskMetrics?.maxDrawdown ?? MOCK_REPORT.riskMetrics.maxDrawdown,
    },
    riskAdjMetrics: {
      ...MOCK_REPORT.riskAdjMetrics,
      ...source?.riskAdjMetrics,
      sharpeRatio: metrics.sharpeRatio ?? source?.riskAdjMetrics?.sharpeRatio ?? MOCK_REPORT.riskAdjMetrics.sharpeRatio,
    },
    tradeStats: {
      ...MOCK_REPORT.tradeStats,
      ...source?.tradeStats,
      totalTrades: metrics.totalTrades ?? source?.tradeStats?.totalTrades ?? MOCK_REPORT.tradeStats.totalTrades,
      winRate: metrics.winRate ?? source?.tradeStats?.winRate ?? MOCK_REPORT.tradeStats.winRate,
    },
    executiveSummary: {
      ...MOCK_REPORT.executiveSummary,
      ...source?.executiveSummary,
      keyMetrics: {
        annualizedReturn: metrics.annualizedReturn ?? source?.executiveSummary?.keyMetrics.annualizedReturn ?? MOCK_REPORT.executiveSummary.keyMetrics.annualizedReturn,
        maxDrawdown: metrics.maxDrawdown ?? source?.executiveSummary?.keyMetrics.maxDrawdown ?? MOCK_REPORT.executiveSummary.keyMetrics.maxDrawdown,
        sharpeRatio: metrics.sharpeRatio ?? source?.executiveSummary?.keyMetrics.sharpeRatio ?? MOCK_REPORT.executiveSummary.keyMetrics.sharpeRatio,
      },
    },
    equityData: {
      ...MOCK_REPORT.equityData,
      ...source?.equityData,
      equityCurve: (bt.equityCurve ?? []).map((p) => ({
        timestamp: p.timestamp,
        equity: p.equity,
      })),
      drawdownCurve: bt.drawdownCurve ?? [],
      monthlyReturns: bt.monthlyReturns ?? [],
      annualReturns: bt.annualReturns ?? [],
      benchmarkCurve: [],
    },
  });
}

export { localizeJobState, localizeResearchJob };
