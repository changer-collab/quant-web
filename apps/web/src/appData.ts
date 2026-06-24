// Re-export types
export type {
  AppState,
  CreateResearchReportInput,
  CreateResearchJobInput,
  FactorDisplayRow,
  FactorEvalDisplayResult,
  JobItem,
  JobTemplate,
  LanguageCode,
  MarketTick,
  Metric,
  MetricTone,
  NavItem,
  PageContent,
  PageId,
  PageSection,
  ResearchConfigItem,
  ResearchJob,
  ResearchReport,
  ResearchMode,
  ResearchModeId,
  ResearchRunConfigSummary,
  StrategyRow,
  StrategyParam,
  UiCopy,
  // 回测报告类型
  BacktestReportFull,
  ReportOverview,
  ReportDataParams,
  ReportReturnMetrics,
  ReportRiskMetrics,
  ReportRiskAdjMetrics,
  ReportTradeStats,
  ReportEquityData,
  ReportRobustness,
  ReportAttribution,
  ReportIssues,
  ReportTabId,
  ReportUiCopy,
  ReportExecutiveSummary,
  ReportConclusion,
  ReportPositionAnalysis,
  ReportSubStrategyAttribution,
  ReportStressTest,
  ReportCostSensitivity,
  ReportBenchmarkComparison,
  ReportRiskWarnings,
  EquityDataPoint,
  MonthlyReturn,
  AnnualReturn,
  DrawdownPoint,
  ParamSensitivity,
  RollingWindowResult,
  MarketRegimeResult,
  IndustryExposure,
  FactorExposure,
  TimingSelection,
  // 因子报告类型
  FactorReportFull,
  FactorReportBasicInfo,
  FactorReportDescriptiveStats,
  FactorReportGroupBacktest,
  FactorReportICAnalysis,
  FactorReportRegression,
  FactorReportRisk,
  FactorReportTurnover,
  FactorReportNeutralization,
  FactorReportDomain,
  FactorReportCorrelation,
  FactorReportMultiFactor,
  FactorReportEconomicLogic,
  FactorReportRobustness,
  FactorReportMonitoring,
  FactorReportConclusion,
  FactorReportTabId,
  FactorReportUiCopy,
  FactorGrade,
} from './data/types';

export { FactorStatus } from './data/types';

// Re-export accessors
export {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getContent,
  getFactorEvalResults,
  getFactors,
  getJobs,
  getMarketTicks,
  getNavItems,
  getPage,
  getPages,
  getResearchMode,
  getResearchModes,
  getStrategies,
  getUiCopy,
  getReportUiCopy,
  getFactorReports,
  getFactorReportUiCopy,
  resolveLanguageCode,
  JOBS,
  MARKET_TICKS,
  NAV_ITEMS,
  PAGES,
  RESEARCH_MODES,
  STRATEGIES,
} from './data/accessors';

// Re-export factories and localization
export {
  createResearchJob,
  createResearchReport,
  createBacktestReportFull,
  mapBacktestResultToReport,
  localizeJobState,
  localizeResearchJob,
} from './data/factories';

// State helpers (lightweight, kept here)
import type { AppState, PageId } from './data/types';
import { CONTENT, DEFAULT_LANGUAGE } from './data/accessors';

export function createInitialState(): AppState {
  return { activePage: 'dashboard' };
}

export function isPageId(id: string): id is PageId {
  return id in CONTENT[DEFAULT_LANGUAGE].pages;
}

export function setActivePage(state: AppState, id: string): AppState {
  if (isPageId(id)) {
    state.activePage = id;
  }
  return state;
}
