import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  createResearchReport,
  createBacktestReportFull,
  mapBacktestResultToReport,
  isPageId,
  localizeResearchJob,
  type AppState,
  type LanguageCode,
  type ResearchJob,
  type ResearchReport,
  type BacktestReportFull,
  type StrategyRow,
} from '../appData';
import { fetchReports, fetchReport } from '../api/reports';

function formatReportTime(language: LanguageCode): string {
  return new Date().toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', { hour12: false });
}

function formatDate(ts: number): string {
  const date = new Date(ts);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function useResearchWorkflow(language: LanguageCode) {
  const [state, setState] = useState<AppState>(() => ({ activePage: 'dashboard' }));
  const [jobs, setJobs] = useState<ResearchJob[]>([]);
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [backtestReports, setBacktestReports] = useState<BacktestReportFull[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | undefined>();

  // 初始化时加载历史报告列表
  useEffect(() => {
    let cancelled = false;
    fetchReports({ limit: 50 })
      .then(async (summaries) => {
        if (cancelled) return;
        const historicalResearchReports: ResearchReport[] = [];
        const historicalReports: BacktestReportFull[] = [];
        const locale = language === 'zh' ? 'zh-CN' : 'en-US';

        const detailPromises = summaries.map((s) => fetchReport(s.id).catch(() => null));
        const details = await Promise.all(detailPromises);
        if (cancelled) return;

        summaries.forEach((s, index) => {
          const reportId = `report-${s.id}`;
          const generatedAt = new Date(s.createdAt).toLocaleTimeString(locale, { hour12: false });

          historicalResearchReports.push(
            createResearchReport(
              { id: reportId, jobId: s.taskId, sequence: index + 1, generatedAt },
              language
            )
          );

          const detail = details[index];
          if (detail?.reportData) {
            const { id: _apiId, ...rdRest } = detail.reportData as Partial<BacktestReportFull> & {
              id?: string;
            };
            historicalReports.push(
              createBacktestReportFull({
                id: `backtest-full-${reportId}`,
                taskId: s.taskId,
                status: 'completed',
                generatedAt,
                strategyName: s.strategyName,
                ...rdRest,
              })
            );
          } else {
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
              })
            );
          }
        });

        setReports((current) => {
          const existing = new Set(current.map((r) => r.id));
          const merged = [...current];
          for (const r of historicalResearchReports) {
            if (!existing.has(r.id)) merged.push(r);
          }
          return merged;
        });
        setBacktestReports((current) => {
          const existing = new Set(current.map((r) => r.id));
          const merged = [...current];
          for (const r of historicalReports) {
            if (!existing.has(r.id)) merged.push(r);
          }
          return merged;
        });

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
    return () => {
      cancelled = true;
    };
  }, [language]);

  const localizedJobs = useMemo(
    () => jobs.map((job) => localizeResearchJob(job, language)),
    [jobs, language]
  );
  const activeReport = useMemo(
    () => reports.find((report) => report.id === activeReportId),
    [activeReportId, reports]
  );
  const activeBacktestReport = useMemo(
    () => backtestReports.find((r) => r.id === `backtest-full-${activeReportId}`),
    [activeReportId, backtestReports]
  );
  const reportJobIds = useMemo(() => reports.map((report) => report.jobId), [reports]);

  function handleNavClick(pageId: string) {
    if (isPageId(pageId)) {
      setState((current) => ({ ...current, activePage: pageId }));
    }
  }

  /** 注册回测结果（从 WorkspacePage 回流，让"回测报告"和"任务中心"可见） */
  const registerBacktestResult = useCallback(
    (params: {
      taskId: string;
      taskResult: Record<string, unknown> | undefined;
      strategy: StrategyRow;
      config: {
        symbol: string;
        timeframe: string;
        initialCash: number;
        startTs: number;
        endTs: number;
      };
    }) => {
      const { taskId, taskResult, strategy, config } = params;
      const generatedAt = formatReportTime(language);
      const reportId = `report-${Date.now()}`;
      const fullReportId = `backtest-full-${reportId}`;

      const nextReport = createResearchReport(
        {
          id: reportId,
          jobId: taskId,
          mode: strategy.category ?? 'non_factor',
          sequence: reports.length + 1,
          strategy,
          generatedAt,
        },
        language
      );

      const nextBacktestReport = mapBacktestResultToReport(
        { backtestResult: taskResult },
        {
          id: fullReportId,
          taskId,
          status: 'completed',
          generatedAt,
          strategyName: strategy.name,
          overview: {
            name: strategy.name,
            version: strategy.version ?? '',
            logic: strategy.description ?? '',
            instruments: [config.symbol],
            timeRange: {
              start: formatDate(config.startTs),
              end: formatDate(config.endTs),
            },
            frequency: config.timeframe,
            benchmark: '',
            strategyCategory: strategy.kind ?? 'timing',
          },
          dataParams: {
            dataSource: 'local',
            adjustmentType: '',
            fee: { commission: 0, stampTax: 0 },
            slippage: { model: 'fixed', value: 0.001 },
            capital: {
              initialCash: config.initialCash,
              maxLeverage: 1.0,
              positionLimit: 0.95,
            },
            params: (strategy.params ?? []).map((param) => ({
              label: param.label,
              value: String(param.default),
            })),
          },
        }
      );

      setReports((current) => [nextReport, ...current]);
      setBacktestReports((current) => [nextBacktestReport, ...current]);
      setActiveReportId(nextReport.id);
    },
    [language, reports.length]
  );

  function handleViewReport(job: ResearchJob) {
    const report = reports.find((item) => item.jobId === job.id);
    if (!report) {
      return;
    }
    setActiveReportId(report.id);
    setState((current) => ({ ...current, activePage: 'backtest' }));
  }

  function handleSwitchBacktestReport(reportId: string) {
    const btReport = backtestReports.find((r) => r.id === reportId);
    if (!btReport) return;
    const runId = btReport.id.replace('backtest-full-', '');
    const reportIdMatch = reports.find((r) => r.id === runId);
    if (reportIdMatch) {
      setActiveReportId(reportIdMatch.id);
    }
  }

  return {
    state,
    localizedJobs,
    activeReport,
    activeBacktestReport,
    backtestReports,
    reportJobIds,
    handleNavClick,
    registerBacktestResult,
    handleViewReport,
    handleSwitchBacktestReport,
  };
}
