import { Suspense, lazy, useMemo } from 'react';
import { useLanguage, usePageContent } from './hooks/useLanguage';
import { useResearchWorkflow } from './hooks/useResearchWorkflow';
import { useStrategies } from './hooks/useStrategies';
import { useTasks } from './hooks/useTasks';
import { useFactors } from './hooks/useFactors';
import { ErrorBoundary } from './components/error-boundary';
import { MetricCard } from './components/common';
import { ChartMockup } from './components/charts';
import { ReportSummary } from './components/report-summary';
import { LanguageSettings } from './components/settings';
import { FactorLabContent } from './components/factor-lab';
import { WorkspaceContent, WorkspaceModeTabs } from './components/workspace';
import { ActivityFeed } from './components/activity-feed';
import { StrategyGrid } from './components/strategy-grid';
import { BacktestHistory } from './components/backtest-history';
import { ExperimentTable } from './components/experiment-table';
import { DataCoveragePanel } from './components/data-coverage';
import { JobList } from './components/jobs';
import type { ResearchJob, ResearchModeId, JobTemplate } from './appData';
import layout from './styles/layout.module.css';
import nav from './styles/nav.module.css';
import hero from './styles/hero.module.css';
import buttons from './styles/buttons.module.css';
import infoPanelStyles from './styles/info-panel.module.css';
import './styles/tokens.css';

const FullReport = lazy(() => import('./components/report').then((module) => ({ default: module.FullReport })));

export default function App() {
  const { language, handleLanguageChange, navItems, ui, researchModes, factorEvalResults, reportUiCopy } = useLanguage();
  const { strategies: apiStrategies } = useStrategies();
  const { tasks: apiTasks } = useTasks();
  const { factors: apiFactors } = useFactors();
  const strategies = apiStrategies;
  const factors = apiFactors;
  const {
    state,
    activeMode,
    setActiveMode,
    selectedStrategy,
    researchMode,
    localizedJobs,
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
  } = useResearchWorkflow(language);
  const { activePage } = usePageContent(state.activePage, language);

  // 将 API 任务映射为 ResearchJob 并与本地任务合并
  const allJobs = useMemo<ResearchJob[]>(() => {
    // 策略 id → 显示名映射（用于刷新后从 API 任务还原真实策略名）
    const strategyNameById = new Map(strategies.map((s) => [s.id, s.name]));
    const apiJobs: ResearchJob[] = apiTasks.map((task) => {
      const strategyId = (task.payload.strategy as string) ?? '';
      const strategyName = strategyNameById.get(strategyId) ?? strategyId;
      return {
        id: task.id,
        name: strategyName || `${task.type} #${task.id}`,
        kind: task.type,
        state: task.status,
        progress: task.status === 'completed' ? 100 : task.status === 'running' ? 50 : 0,
        strategyName,
        errorMessage: task.error,
        mode: 'traditional' as ResearchModeId,
        template: task.type as JobTemplate,
      };
    });
    return [...localizedJobs, ...apiJobs];
  }, [localizedJobs, apiTasks, strategies]);

  const isGeneratedReportPage = state.activePage === 'backtest' && Boolean(activeReport);
  const pageTitle =
    state.activePage === 'workspace' ? researchMode.title : isGeneratedReportPage && activeReport ? activeReport.title : activePage.title;
  const pageStatus =
    state.activePage === 'workspace'
      ? researchMode.description
      : isGeneratedReportPage && activeReport
        ? activeReport.status
        : activePage.status;
  const heroMetrics = useMemo(() => {
    if (state.activePage === 'workspace') return researchMode.heroMetrics;
    if (isGeneratedReportPage && activeBacktestReport) {
      const rm = activeBacktestReport.returnMetrics;
      const rs = activeBacktestReport.riskAdjMetrics;
      return [
        { label: '年化收益', value: `${(rm.annualizedReturn * 100).toFixed(1)}%`, tone: rm.annualizedReturn > 0 ? 'good' as const : 'warn' as const },
        { label: '最大回撤', value: `${(activeBacktestReport.riskMetrics.maxDrawdown * 100).toFixed(1)}%`, tone: 'warn' as const },
        { label: '夏普比率', value: rs.sharpeRatio.toFixed(2), tone: rs.sharpeRatio > 1 ? 'good' as const : 'warn' as const },
        { label: '交易次数', value: activeBacktestReport.tradeStats.totalTrades.toLocaleString(), tone: 'info' as const },
      ];
    }
    return activePage.heroMetrics;
  }, [state.activePage, isGeneratedReportPage, activeBacktestReport, researchMode.heroMetrics, activePage.heroMetrics]);
  const sections =
    state.activePage === 'workspace'
      ? researchMode.sections
      : isGeneratedReportPage && activeReport
        ? activeReport.diagnostics
        : activePage.sections;

  return (
    <ErrorBoundary>
    <div id="app" className={`${layout.shell} ${layout.pageTransition}`} key={state.activePage}>
      <aside className={layout.sidebar}>
        <div className={layout.brand}>
          <span className={`${layout.brandIcon} pulseGlow`}>Q</span>
          <div>
            <strong className={layout.brandName}>QuantForge</strong>
            <small className={layout.brandTagline}>{ui.brandTagline}</small>
          </div>
        </div>
        <nav aria-label={ui.navAriaLabel} className={nav.navList}>
          {navItems.map((item) => (
            <button
              className={`${nav.navItem} ${item.id === state.activePage ? nav.navItemActive : ''}`}
              data-page={item.id}
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              type="button"
            >
              <small className={nav.navEyebrow}>{item.eyebrow}</small>
              <span className={nav.navLabel}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className={layout.mainShell}>
        <header className={layout.topbar}>
          <div className={layout.topbarStatus}>
            <span className={`${layout.statusLight} statusPulse`} />
            <span>{pageStatus}</span>
          </div>
          <button className={buttons.primaryAction} data-testid="run-research" onClick={handleRunResearch} type="button">
            {ui.runResearch}
          </button>
        </header>
        <section className={hero.hero}>
          <div>
            <p className={hero.heroEyebrow}>{ui.heroEyebrow}</p>
            <h1 className={hero.heroTitle}>{pageTitle}</h1>
            <span className={hero.heroSubtitle}>{activePage.subtitle}</span>
          </div>
          <div className={hero.metricGrid}>
            {heroMetrics.map((metric) => (
              <MetricCard key={metric.label} metric={metric} />
            ))}
          </div>
        </section>
        {state.activePage === 'workspace' && (
          <WorkspaceModeTabs activeMode={activeMode} modes={researchModes} onChange={setActiveMode} ui={ui} />
        )}
        {state.activePage === 'settings' && (
          <LanguageSettings language={language} onChange={handleLanguageChange} ui={ui} />
        )}
        <section className={layout.contentGrid}>
          <div className={layout.primaryColumn}>
            {state.activePage === 'factor-lab' ? (
              <FactorLabContent factors={factors} factorEvalResults={factorEvalResults} ui={ui} language={language} />
            ) : isGeneratedReportPage && activeReport ? (
              activeBacktestReport ? (
                <Suspense fallback={<ReportSummary report={activeReport} ui={ui} />}>
                  <FullReport report={activeBacktestReport} ui={reportUiCopy} allReports={backtestReports} onSwitchReport={handleSwitchBacktestReport} />
                </Suspense>
              ) : (
                <>
                  <ReportSummary report={activeReport} ui={ui} />
                  <ChartMockup ariaLabel={ui.chartAriaLabel} priceUp={reportUiCopy.chartLabels.priceUp} priceDown={reportUiCopy.chartLabels.priceDown} />
                </>
              )
            ) : state.activePage === 'workspace' ? (
              <WorkspaceContent
                mode={researchMode}
                configSummary={activeConfigSummary}
                onRunResearch={handleRunResearch}
                strategies={strategies}
                selectedStrategy={selectedStrategy}
                backtestConfig={backtestConfig}
                onConfigChange={setBacktestConfig}
                ticks={[]}
                ui={ui}
              />
            ) : (
              <>
                <ChartMockup ariaLabel={ui.chartAriaLabel} priceUp={reportUiCopy.chartLabels.priceUp} priceDown={reportUiCopy.chartLabels.priceDown} />
                {state.activePage === 'dashboard' && (
                  <ActivityFeed jobs={allJobs} ui={ui} />
                )}
                {state.activePage === 'strategies' && (
                  <StrategyGrid
                    strategies={strategies}
                    onSelectStrategy={handleSelectStrategy}
                    selectedStrategyId={selectedStrategy?.id}
                    ui={ui}
                  />
                )}
                {state.activePage === 'backtest' && !activeReport && (
                  <BacktestHistory
                    jobs={allJobs}
                    onViewReport={handleViewReport}
                    reportJobIds={reportJobIds}
                    ui={ui}
                  />
                )}
                {state.activePage === 'experiments' && (
                  <ExperimentTable ui={ui} />
                )}
                {state.activePage === 'data' && (
                  <DataCoveragePanel ui={ui} />
                )}
                {state.activePage === 'jobs' && (
                  <JobList jobs={allJobs} onViewReport={handleViewReport} reportJobIds={reportJobIds} ui={ui} />
                )}
              </>
            )}
          </div>
          <div className={layout.secondaryColumn}>
            {sections.map((section) => (
              <InfoPanel key={section.title} section={section} />
            ))}
          </div>
        </section>
      </main>
    </div>
    </ErrorBoundary>
  );
}

function InfoPanel({ section }: { section: { title: string; items: string[] } }) {
  return (
    <section className={infoPanelStyles.infoPanel}>
      <h3>{section.title}</h3>
      <div className={infoPanelStyles.chipRow}>
        {section.items.map((item) => (
          <span className={infoPanelStyles.chip} key={item}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
