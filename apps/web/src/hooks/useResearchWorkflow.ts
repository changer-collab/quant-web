import { useMemo, useState } from 'react';
import {
  createResearchJob,
  createResearchReport,
  getJobs,
  getResearchMode,
  getStrategies,
  isPageId,
  localizeResearchJob,
  type AppState,
  type LanguageCode,
  type ResearchModeId,
  type ResearchJob,
  type ResearchReport,
  type StrategyRow,
} from '../appData';

function formatReportTime(language: LanguageCode): string {
  return new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
}

export function useResearchWorkflow(language: LanguageCode) {
  const [state, setState] = useState<AppState>(() => ({ activePage: 'dashboard' }));
  const [activeMode, setActiveMode] = useState<ResearchModeId>('traditional');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | undefined>();
  const [jobs, setJobs] = useState<ResearchJob[]>(() => getJobs(language));
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | undefined>();

  const researchMode = useMemo(() => getResearchMode(activeMode, language), [activeMode, language]);
  const localizedJobs = useMemo(() => jobs.map((job) => localizeResearchJob(job, language)), [jobs, language]);
  const selectedStrategyForLanguage = useMemo(
    () => getStrategies(language).find((strategy) => strategy.id === selectedStrategy?.id),
    [language, selectedStrategy?.id],
  );
  const activeReport = useMemo(
    () => reports.find((report) => report.id === activeReportId),
    [activeReportId, reports],
  );
  const reportJobIds = useMemo(() => reports.map((report) => report.jobId), [reports]);
  const activeConfigSummary = useMemo(
    () => researchMode.configItems.map((item) => `${item.label}: ${item.value}`),
    [researchMode.configItems],
  );

  function handleNavClick(pageId: string) {
    if (isPageId(pageId)) {
      setState((current) => ({ ...current, activePage: pageId }));
    }
  }

  function handleSelectStrategy(strategy: StrategyRow) {
    setSelectedStrategy(strategy);
    setActiveMode(strategy.mode);
    setState((current) => ({ ...current, activePage: 'workspace' }));
  }

  function handleRunResearch() {
    const runId = Date.now();
    const jobId = `job-${runId}`;
    const sequence = jobs.length + 1;
    const nextJob = createResearchJob(
      {
        id: jobId,
        mode: activeMode,
        sequence,
        strategy: selectedStrategyForLanguage,
        configSummary: activeConfigSummary,
      },
      language,
    );
    const nextReport = createResearchReport(
      {
        id: `report-${runId}`,
        jobId,
        mode: activeMode,
        sequence,
        strategy: selectedStrategyForLanguage,
        generatedAt: formatReportTime(language),
        configSummary: activeConfigSummary,
      },
      language,
    );

    setJobs((current) => [nextJob, ...current]);
    setReports((current) => [nextReport, ...current]);
    setActiveReportId(nextReport.id);
    setState((current) => ({ ...current, activePage: 'jobs' }));
  }

  function handleViewReport(job: ResearchJob) {
    const report = reports.find((item) => item.jobId === job.id);
    if (!report) {
      return;
    }
    setActiveReportId(report.id);
    setState((current) => ({ ...current, activePage: 'backtest' }));
  }

  return {
    state,
    activeMode,
    setActiveMode,
    selectedStrategy,
    researchMode,
    localizedJobs,
    selectedStrategyForLanguage,
    activeReport,
    reportJobIds,
    activeConfigSummary,
    handleNavClick,
    handleSelectStrategy,
    handleRunResearch,
    handleViewReport,
  };
}
