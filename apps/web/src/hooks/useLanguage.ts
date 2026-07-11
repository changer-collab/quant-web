import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  getNavItems,
  getPage,
  getStrategies,
  getMarketTicks,
  getFactors,
  getFactorEvalResults,
  getUiCopy,
  getResearchCopy,
  getReportUiCopy,
  resolveLanguageCode,
  type LanguageCode,
  type NavItem,
  type PageContent,
  type StrategyRow,
  type MarketTick,
  type FactorDisplayRow,
  type FactorEvalDisplayResult,
  type UiCopy,
  type ResearchCopy,
} from '../appData';

export function useLanguage() {
  const [language, setLanguage] = useState<LanguageCode>(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_LANGUAGE;
    }
    return resolveLanguageCode(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  });

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language]);

  function handleLanguageChange(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }

  const navItems = useMemo(() => getNavItems(language), [language]);
  const ui = useMemo(() => getUiCopy(language), [language]);
  const researchCopy = useMemo(() => getResearchCopy(language), [language]);
  const strategies = useMemo(() => getStrategies(language), [language]);
  const ticks = useMemo(() => getMarketTicks(language), [language]);
  const factors = useMemo(() => getFactors(language), [language]);
  const factorEvalResults = useMemo(() => getFactorEvalResults(language), [language]);
  const reportUiCopy = useMemo(() => getReportUiCopy(language), [language]);

  return {
    language,
    handleLanguageChange,
    navItems,
    ui,
    researchCopy,
    strategies,
    ticks,
    factors,
    factorEvalResults,
    reportUiCopy,
  };
}

export function usePageContent(activePageId: string, language: LanguageCode) {
  const activePage = useMemo(() => getPage(activePageId, language), [activePageId, language]);
  return { activePage };
}

export {
  type NavItem,
  type PageContent,
  type StrategyRow,
  type MarketTick,
  type FactorDisplayRow,
  type FactorEvalDisplayResult,
  type UiCopy,
  type ResearchCopy,
};
