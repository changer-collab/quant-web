import { useMemo } from 'react';
import { useLanguage, usePageContent } from './hooks/useLanguage';
import { useResearchWorkflow } from './hooks/useResearchWorkflow';
import { useStrategies } from './hooks/useStrategies';
import { useTasks } from './hooks/useTasks';
import { useFactors } from './hooks/useFactors';
import { ErrorBoundary } from './components/error-boundary';
import { MetricCard } from './components/common';
import { ChartMockup } from './components/charts';
import { ReportSummary, FullReport } from './components/report';
import { LanguageSettings } from './components/settings';
import { FactorLabContent } from './components/factor-lab';
import { WorkspaceContent, WorkspaceModeTabs } from './components/workspace';
import { ActivityFeed } from './components/activity-feed';
import { StrategyGrid } from './components/strategy-grid';
import { BacktestHistory } from './components/backtest-history';
import { ExperimentTable } from './components/experiment-table';
import { DataCoveragePanel } from './components/data-coverage';
import { JobList } from './components/jobs';
import type { ResearchJob, ResearchModeId } from './appData';
import layout from './styles/layout.module.css';
import nav from './styles/nav.module.css';
import hero from './styles/hero.module.css';
import buttons from './styles/buttons.module.css';
import infoPanelStyles from './styles/info-panel.module.css';
import './styles/tokens.css';

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
    const apiJobs: ResearchJob[] = apiTasks.map((task) => ({
      id: task.id,
      name: `${task.type} #${task.id}`,
      kind: task.type,
      state: task.status,
      progress: task.status === 'completed' ? 100 : task.status === 'running' ? 50 : 0,
      strategyName: (task.payload.strategy as string) ?? '',
      mode: 'traditional' as ResearchModeId,
    }));
    return [...localizedJobs, ...apiJobs];
  }, [localizedJobs, apiTasks]);

  const isGeneratedReportPage = state.activePage === 'backtest' && Boolean(activeReport);
  const pageTitle =
    state.activePage === 'workspace' ? researchMode.title : isGeneratedReportPage && activeReport ? activeReport.title : activePage.title;
  const pageStatus =
    state.activePage === 'workspace'
      ? researchMode.description
      : isGeneratedReportPage && activeReport
        ? activeReport.status
        : activePage.status;
  const heroMetrics =
    state.activePage === 'workspace'
      ? researchMode.heroMetrics
      : isGeneratedReportPage && activeReport
        ? activeReport.metrics
        : activePage.heroMetrics;
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
                <FullReport report={activeBacktestReport} ui={reportUiCopy} allReports={backtestReports} onSwitchReport={handleSwitchBacktestReport} />
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
