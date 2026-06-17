import { useMemo, useState, useCallback } from 'react';
import {
  createResearchJob,
  createResearchReport,
  createBacktestReportFull,
  mapBacktestResultToReport,
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
  const { submitBacktestTask, submitAndStream } = useTasks();

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
    const sequence = jobs.length + 1;

    // 尝试 API 提交，失败则 fallback 到模拟数据
    if (selectedStrategy) {
      submitBacktestTask({
        strategy: selectedStrategy.id,
        symbol: '600519',
        timeframe: '1d',
        initialCash: 1000000,
        slippage: 0.001,
      })
        .then((taskId) => {
          // 创建本地 job 跟踪进度（初始 progress=0）
          const nextJob = createResearchJob(
            { id: taskId, mode: activeMode, sequence, strategy: selectedStrategyForLanguage, configSummary: activeConfigSummary },
            language,
          );
          setJobs((current) => [nextJob, ...current]);

          // 流式跟踪任务
          submitAndStream(taskId, (event) => {
            if (event.type === 'progress') {
              // 实时更新 job 进度
              setJobs((current) =>
                current.map((j) => j.id === taskId ? { ...j, progress: event.percent ?? j.progress } : j),
              );
            }
            if (event.type === 'result') {
              // 创建报告 — 用真实回测结果映射
              const nextReport = createResearchReport(
                { id: `report-${runId}`, jobId: taskId, mode: activeMode, sequence, strategy: selectedStrategyForLanguage, generatedAt: formatReportTime(language), configSummary: activeConfigSummary },
                language,
              );
              const nextBacktestReport = mapBacktestResultToReport(
                event.data as { taskId?: string; backtestResult?: unknown } | undefined,
                {
                  id: `backtest-full-report-${runId}`, taskId, status: 'completed', generatedAt: formatReportTime(language),
                },
              );
              setReports((current) => [nextReport, ...current]);
              setBacktestReports((current) => [nextBacktestReport, ...current]);
              setActiveReportId(nextReport.id);
            }
            if (event.type === 'error') {
              // 任务失败，fallback 到模拟数据
              createMockJobAndReport(runId, `job-${runId}`, sequence);
            }
          });
        })
        .catch(() => {
          // API 不可用，fallback 到模拟数据
          createMockJobAndReport(runId, `job-${runId}`, sequence);
        });
    } else {
      createMockJobAndReport(runId, `job-${runId}`, sequence);
    }

    setState((current) => ({ ...current, activePage: 'jobs' }));
  }, [jobs.length, selectedStrategy, activeMode, selectedStrategyForLanguage, activeConfigSummary, language, submitBacktestTask, submitAndStream]);

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
