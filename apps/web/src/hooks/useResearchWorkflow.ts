import { useMemo, useState, useCallback } from 'react';
import {
  createResearchJob,
  createResearchReport,
  createBacktestReportFull,
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
  type BacktestReportFull,
  type StrategyRow,
} from '../appData';
import { useTasks } from './useTasks';

function formatReportTime(language: LanguageCode): string {
  return new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
}

export function useResearchWorkflow(language: LanguageCode) {
  const [state, setState] = useState<AppState>(() => ({ activePage: 'dashboard' }));
  const [activeMode, setActiveMode] = useState<ResearchModeId>('traditional');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | undefined>();
  const [jobs, setJobs] = useState<ResearchJob[]>(() => getJobs(language));
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [backtestReports, setBacktestReports] = useState<BacktestReportFull[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | undefined>();
  const { submitAndPoll } = useTasks();

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
  const activeBacktestReport = useMemo(
    () => backtestReports.find((r) => r.id === `backtest-full-${activeReportId}`),
    [activeReportId, backtestReports],
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

  function createMockJobAndReport(runId: number, jobId: string, sequence: number) {
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
    const nextBacktestReport = createBacktestReportFull({
      id: `backtest-full-report-${runId}`,
      taskId: jobId,
      status: 'completed',
      generatedAt: formatReportTime(language),
    });
    setJobs((current) => [nextJob, ...current]);
    setReports((current) => [nextReport, ...current]);
    setBacktestReports((current) => [nextBacktestReport, ...current]);
    setActiveReportId(nextReport.id);
  }

  const handleRunResearch = useCallback(() => {
    const runId = Date.now();
    const jobId = `job-${runId}`;
    const sequence = jobs.length + 1;

    // 尝试 API 提交，失败则 fallback 到模拟数据
    if (selectedStrategy) {
      submitAndPoll({
        strategy: selectedStrategy.id,
        symbol: '600519',
        timeframe: '1d',
        initialCash: 1000000,
        slippage: 0.001,
      })
        .then((task) => {
          if (task.status === 'completed') {
            // API 成功：用任务结果创建报告
            const nextReport = createResearchReport(
              {
                id: `report-${runId}`,
                jobId: task.id,
                mode: activeMode,
                sequence,
                strategy: selectedStrategyForLanguage,
                generatedAt: formatReportTime(language),
                configSummary: activeConfigSummary,
              },
              language,
            );
            const nextBacktestReport = createBacktestReportFull({
              id: `backtest-full-report-${runId}`,
              taskId: task.id,
              status: 'completed',
              generatedAt: formatReportTime(language),
            });
            setReports((current) => [nextReport, ...current]);
            setBacktestReports((current) => [nextBacktestReport, ...current]);
            setActiveReportId(nextReport.id);
          } else {
            // 任务失败，fallback
            createMockJobAndReport(runId, jobId, sequence);
          }
        })
        .catch(() => {
          // API 不可用，fallback 到模拟数据
          createMockJobAndReport(runId, jobId, sequence);
        });
    } else {
      createMockJobAndReport(runId, jobId, sequence);
    }

    setState((current) => ({ ...current, activePage: 'jobs' }));
  }, [jobs.length, selectedStrategy, activeMode, selectedStrategyForLanguage, activeConfigSummary, language, submitAndPoll]);

  function handleViewReport(job: ResearchJob) {
    const report = reports.find((item) => item.jobId === job.id);
    if (!report) {
      return;
    }
    setActiveReportId(report.id);
    setState((current) => ({ ...current, activePage: 'backtest' }));
  }

  function handleSwitchBacktestReport(reportId: string) {
    // reportId 是 backtestReport 的 id，需要找到对应的 report
    const btReport = backtestReports.find((r) => r.id === reportId);
    if (!btReport) return;
    // 从 backtestReport id 反推 report id: "backtest-full-report-xxx" -> "report-xxx"
    const runId = btReport.id.replace('backtest-full-', '');
    const reportIdMatch = reports.find((r) => r.id === runId);
    if (reportIdMatch) {
      setActiveReportId(reportIdMatch.id);
    }
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
    activeBacktestReport,
    backtestReports,
    reportJobIds,
    activeConfigSummary,
    handleNavClick,
    handleSelectStrategy,
    handleRunResearch,
    handleViewReport,
    handleSwitchBacktestReport,
  };
}
