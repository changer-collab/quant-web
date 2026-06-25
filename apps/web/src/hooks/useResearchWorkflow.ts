import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  createResearchJob,
  createResearchReport,
  createBacktestReportFull,
  mapBacktestResultToReport,
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
import { fetchReports, fetchReport } from '../api/reports';
import { useTasks } from './useTasks';

function formatReportTime(language: LanguageCode): string {
  return new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
}

/** 回测配置（用户在 Workspace 面板填写） */
export interface BacktestConfig {
  symbol: string;
  timeframe: string;
  initialCash: number;
  slippage: number;
  startTs: number;
  endTs: number;
  params: Record<string, unknown>;
}

export function useResearchWorkflow(language: LanguageCode) {
  const [state, setState] = useState<AppState>(() => ({ activePage: 'dashboard' }));
  const [activeMode, setActiveMode] = useState<ResearchModeId>('traditional');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | undefined>();
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [backtestReports, setBacktestReports] = useState<BacktestReportFull[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | undefined>();
  const [backtestConfig, setBacktestConfig] = useState<BacktestConfig>(() => {
    // 数据库现有行情数据范围：2023-01-01 ~ 2024-12-31
    const startTs = 1672675200000; // 2023-01-01
    const endTs = 1735574400000; // 2024-12-31
    return {
      symbol: '600519',
      timeframe: '1d',
      initialCash: 1_000_000,
      slippage: 0.001,
      startTs,
      endTs,
      params: {},
    };
  });
  const { submitBacktestTask, submitAndStream } = useTasks();

  // 初始化时加载历史报告列表
  useEffect(() => {
    let cancelled = false;
    fetchReports({ limit: 50 })
      .then(async (summaries) => {
        if (cancelled) return;
        const historicalResearchReports: ResearchReport[] = [];
        const historicalReports: BacktestReportFull[] = [];
        const locale = language === 'zh' ? 'zh-CN' : 'en-US';

        // 批量获取完整报告数据（并行请求，失败时降级到摘要）
        const detailPromises = summaries.map((s) =>
          fetchReport(s.id).catch(() => null),
        );
        const details = await Promise.all(detailPromises);
        if (cancelled) return;

        summaries.forEach((s, index) => {
          const reportId = `report-${s.id}`;
          const generatedAt = new Date(s.createdAt).toLocaleTimeString(locale, { hour12: false });

          historicalResearchReports.push(
            createResearchReport(
              { id: reportId, jobId: s.taskId, sequence: index + 1, generatedAt },
              language,
            ),
          );

          const detail = details[index];
          if (detail?.reportData) {
            // 有完整 reportData，直接使用
            const { id: _apiId, ...rdRest } = detail.reportData as Partial<BacktestReportFull> & { id?: string };
            historicalReports.push(
              createBacktestReportFull({
                id: `backtest-full-${reportId}`,
                taskId: s.taskId,
                status: 'completed',
                generatedAt,
                strategyName: s.strategyName,
                ...rdRest,
              }),
            );
          } else {
            // 无完整数据，用摘要构建（降级）
            const defaults = createBacktestReportFull();
            historicalReports.push(
              createBacktestReportFull({
                id: `backtest-full-${reportId}`,
                taskId: s.taskId,
                status: 'completed',
                generatedAt,
                strategyName: s.strategyName,
                overview: {
                  ...defaults.overview,
                  name: s.strategyName,
                  instruments: [s.symbol],
                  frequency: s.timeframe,
                  timeRange: {
                    start: s.startTime ? new Date(s.startTime).toISOString().slice(0, 10) : '',
                    end: s.endTime ? new Date(s.endTime).toISOString().slice(0, 10) : '',
                  },
                },
                returnMetrics: {
                  ...defaults.returnMetrics,
                  totalReturn: s.totalReturn,
                  annualizedReturn: s.annualizedReturn,
                },
                riskMetrics: {
                  ...defaults.riskMetrics,
                  maxDrawdown: s.maxDrawdown,
                },
                riskAdjMetrics: {
                  ...defaults.riskAdjMetrics,
                  sharpeRatio: s.sharpeRatio,
                },
                tradeStats: {
                  ...defaults.tradeStats,
                  winRate: s.winRate,
                  totalTrades: s.totalTrades,
                },
              }),
            );
          }
        });

        // 合并 reports（以 id 去重）
        setReports((current) => {
          const existing = new Set(current.map((r) => r.id));
          const merged = [...current];
          for (const r of historicalResearchReports) {
            if (!existing.has(r.id)) merged.push(r);
          }
          return merged;
        });
        // 合并 backtestReports（以 id 去重）
        setBacktestReports((current) => {
          const existing = new Set(current.map((r) => r.id));
          const merged = [...current];
          for (const r of historicalReports) {
            if (!existing.has(r.id)) merged.push(r);
          }
          return merged;
        });

        // 自动选中最新报告（如果尚未选中）
        if (!cancelled) {
          setActiveReportId((current) => {
            if (current) return current;
            return historicalResearchReports[0]?.id;
          });
        }
      })
      .catch(() => {
        // API 不可用，忽略
      });
    return () => { cancelled = true; };
  }, [language]);

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
    // 用策略定义的默认值初始化参数
    const defaultParams: Record<string, unknown> = {};
    for (const param of strategy.params ?? []) {
      defaultParams[param.key] = param.default;
    }
    setBacktestConfig((current) => ({ ...current, params: defaultParams }));
    setState((current) => ({ ...current, activePage: 'workspace' }));
  }

  const handleRunResearch = useCallback(() => {
    const sequence = jobs.length + 1;

    // 尝试 API 提交，失败则不创建任务
    if (selectedStrategy) {
      submitBacktestTask({
        strategy: selectedStrategy.id,
        symbol: backtestConfig.symbol,
        timeframe: backtestConfig.timeframe,
        initialCash: backtestConfig.initialCash,
        slippage: backtestConfig.slippage,
        startTs: backtestConfig.startTs,
        endTs: backtestConfig.endTs,
        params: backtestConfig.params,
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
            if (event.type === 'status') {
              // 将 API 任务状态映射到内部 job 状态
              const statusMap: Record<string, string> = {
                pending: 'Queued',
                running: 'Running',
                completed: 'Completed',
                failed: 'Failed',
              };
              const nextState = statusMap[event.message ?? ''] ?? 'Running';
              setJobs((current) =>
                current.map((j) => j.id === taskId ? { ...j, state: nextState, progress: event.percent ?? j.progress } : j),
              );
            }
            if (event.type === 'progress') {
              // 实时更新 job 进度
              setJobs((current) =>
                current.map((j) => j.id === taskId ? { ...j, progress: event.percent ?? j.progress } : j),
              );
            }
            if (event.type === 'result') {
              // 任务完成，更新 job 状态
              setJobs((current) =>
                current.map((j) => j.id === taskId ? { ...j, state: 'Completed', progress: 100 } : j),
              );
              // 创建报告 — 用真实回测结果映射
              const nextReport = createResearchReport(
                { id: `report-${Date.now()}`, jobId: taskId, mode: activeMode, sequence, strategy: selectedStrategyForLanguage, generatedAt: formatReportTime(language), configSummary: activeConfigSummary },
                language,
              );
              const nextBacktestReport = mapBacktestResultToReport(
                event.data as { taskId?: string; backtestResult?: unknown } | undefined,
                {
                  id: `backtest-full-report-${Date.now()}`, taskId, status: 'completed', generatedAt: formatReportTime(language),
                },
              );
              setReports((current) => [nextReport, ...current]);
              setBacktestReports((current) => [nextBacktestReport, ...current]);
              setActiveReportId(nextReport.id);
            }
            if (event.type === 'error') {
              // 任务失败，标记原 job 为失败状态
              setJobs((current) =>
                current.map((j) => j.id === taskId ? { ...j, state: 'Failed', progress: j.progress } : j),
              );
            }
          });
        })
        .catch(() => {
          // API 不可用，不创建任务
        });
    }

    setState((current) => ({ ...current, activePage: 'jobs' }));
  }, [jobs.length, selectedStrategy, activeMode, selectedStrategyForLanguage, activeConfigSummary, language, submitBacktestTask, submitAndStream, backtestConfig]);

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
    backtestConfig,
    setBacktestConfig,
    handleNavClick,
    handleSelectStrategy,
    handleRunResearch,
    handleViewReport,
    handleSwitchBacktestReport,
  };
}
