import { useLanguage, usePageContent } from './hooks/useLanguage';
import { useResearchWorkflow } from './hooks/useResearchWorkflow';
import { ErrorBoundary } from './components/error-boundary';
import { MetricCard } from './components/common';
import { DataPanel } from './components/data-panel';
import { ReportSummary } from './components/report';
import { LanguageSettings } from './components/settings';
import { FactorLabContent } from './components/factor-lab';
import { WorkspaceContent, WorkspaceModeTabs } from './components/workspace';
import layout from './styles/layout.module.css';
import nav from './styles/nav.module.css';
import hero from './styles/hero.module.css';
import buttons from './styles/buttons.module.css';
import infoPanelStyles from './styles/info-panel.module.css';
import chartStyles from './styles/chart.module.css';
import './styles/tokens.css';

export default function App() {
  const { language, handleLanguageChange, navItems, ui, strategies, ticks, researchModes, factors, factorEvalResults } = useLanguage();
  const {
    state,
    activeMode,
    setActiveMode,
    selectedStrategy,
    researchMode,
    localizedJobs,
    activeReport,
    reportJobIds,
    activeConfigSummary,
    handleNavClick,
    handleSelectStrategy,
    handleRunResearch,
    handleViewReport,
  } = useResearchWorkflow(language);
  const { activePage } = usePageContent(state.activePage, language);

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
    <div id="app" className={layout.shell}>
      <aside className={layout.sidebar}>
        <div className={layout.brand}>
          <span className={layout.brandIcon}>Q</span>
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
            <span className={layout.statusLight} />
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
              <FactorLabContent factors={factors} factorEvalResults={factorEvalResults} ui={ui} />
            ) : isGeneratedReportPage && activeReport ? (
              <>
                <ReportSummary report={activeReport} ui={ui} />
                <ChartMockup ariaLabel={ui.chartAriaLabel} />
              </>
            ) : state.activePage === 'workspace' ? (
              <WorkspaceContent
                mode={researchMode}
                configSummary={activeConfigSummary}
                onRunResearch={handleRunResearch}
                strategies={strategies}
                ticks={ticks}
                ui={ui}
              />
            ) : (
              <>
                <ChartMockup ariaLabel={ui.chartAriaLabel} />
                <DataPanel
                  activePage={state.activePage}
                  jobs={localizedJobs}
                  onSelectStrategy={handleSelectStrategy}
                  onViewReport={handleViewReport}
                  reportJobIds={reportJobIds}
                  selectedStrategyId={selectedStrategy?.id}
                  strategies={strategies}
                  ui={ui}
                />
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

function ChartMockup({ ariaLabel }: { ariaLabel: string }) {
  const bars = ['34%', '48%', '42%', '61%', '55%', '76%', '69%', '82%', '74%', '90%'];

  return (
    <section className={chartStyles.chartPanel} aria-label={ariaLabel}>
      <div className={chartStyles.axis}>
        {bars.map((height) => (
          <i className={chartStyles.bar} key={height} style={{ height }} />
        ))}
      </div>
      <div className={chartStyles.chartLine} />
      <span className={`${chartStyles.tradeDot} ${chartStyles.buyDot}`} />
      <span className={`${chartStyles.tradeDot} ${chartStyles.sellDot}`} />
    </section>
  );
}
