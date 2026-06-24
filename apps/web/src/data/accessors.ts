import { enContent } from '../data/en';
import { zhContent } from '../data/zh';
import type { LanguageCode, LanguageContent } from '../data/types';

export const DEFAULT_LANGUAGE: LanguageCode = 'en';
export const LANGUAGE_STORAGE_KEY = 'quantforge.language';

export const CONTENT: Record<LanguageCode, LanguageContent> = {
  en: enContent,
  zh: zhContent,
};

export function resolveLanguageCode(value: unknown): LanguageCode {
  return value === 'zh' || value === 'en' ? value : DEFAULT_LANGUAGE;
}

export function getContent(language?: LanguageCode): LanguageContent {
  return CONTENT[resolveLanguageCode(language)];
}

export function getNavItems(language?: LanguageCode) {
  return getContent(language).navItems;
}

export function getPages(language?: LanguageCode) {
  return getContent(language).pages;
}

export function getResearchModes(language?: LanguageCode) {
  return getContent(language).researchModes;
}

export function getStrategies(language?: LanguageCode) {
  return getContent(language).strategies;
}

export function getMarketTicks(language?: LanguageCode) {
  return getContent(language).marketTicks;
}

export function getJobs(language?: LanguageCode) {
  return getContent(language).jobs.map((job) => ({ ...job }));
}

export function getUiCopy(language?: LanguageCode) {
  return getContent(language).ui;
}

export function getFactors(language?: LanguageCode) {
  return getContent(language).factors;
}

export function getFactorEvalResults(language?: LanguageCode) {
  return getContent(language).factorEvalResults;
}

export function getReportUiCopy(language?: LanguageCode) {
  return getContent(language).reportUiCopy;
}

export function getFactorReports(language?: LanguageCode) {
  return getContent(language).factorReports;
}

export function getFactorReportUiCopy(language?: LanguageCode) {
  return getContent(language).factorReportUiCopy;
}

export function getPage(id: string, language?: LanguageCode) {
  const pages = getPages(language);
  return pages[(id as keyof typeof pages) in pages ? (id as keyof typeof pages) : 'dashboard'];
}

export function getResearchMode(id: string, language?: LanguageCode) {
  return getResearchModes(language).find((mode) => mode.id === id) ?? getResearchModes(language)[0];
}

export const NAV_ITEMS = getNavItems(DEFAULT_LANGUAGE);
export const RESEARCH_MODES = getResearchModes(DEFAULT_LANGUAGE);
export const PAGES = getPages(DEFAULT_LANGUAGE);
export const STRATEGIES = getStrategies(DEFAULT_LANGUAGE);
export const MARKET_TICKS = getMarketTicks(DEFAULT_LANGUAGE);
export const JOBS = getJobs(DEFAULT_LANGUAGE);
