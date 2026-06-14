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
  UiCopy,
} from './data/types';

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
