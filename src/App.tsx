import { useMemo, useState } from 'react';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  createResearchJob,
  createInitialState,
  getJobs,
  getMarketTicks,
  getNavItems,
  getPage,
  getResearchMode,
  getResearchModes,
  getStrategies,
  getUiCopy,
  localizeResearchJob,
  resolveLanguageCode,
  setActivePage,
  type AppState,
  type LanguageCode,
  type Metric,
  type PageId,
  type PageSection,
  type ResearchMode,
  type ResearchModeId,
  type ResearchJob,
  type StrategyRow,
  type UiCopy,
} from './appData';
import './styles.css';

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className={`metric metric-${metric.tone}`}>
      <span>{metric.label}</span>
      <strong>{metric.value}</strong>
    </article>
  );
}

function InfoPanel({ section }: { section: PageSection }) {
  return (
    <section className="info-panel">
      <h3>{section.title}</h3>
      <div className="chip-row">
        {section.items.map((item) => (
          <span className="chip" key={item}>
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function getStoredLanguage(): LanguageCode {
  if (typeof window === 'undefined') {
    return DEFAULT_LANGUAGE;
  }

  return resolveLanguageCode(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
}

function ChartMockup({ ariaLabel }: { ariaLabel: string }) {
  const bars = ['34%', '48%', '42%', '61%', '55%', '76%', '69%', '82%', '74%', '90%'];

  return (
    <section className="chart-panel" aria-label={ariaLabel}>
      <div className="axis">
        {bars.map((height) => (
          <i key={height} style={{ height }} />
        ))}
      </div>
      <div className="chart-line" />
      <span className="trade-dot buy" />
      <span className="trade-dot sell" />
    </section>
  );
}

function WorkspaceMockup({
  mode,
  onRunResearch,
  ui,
}: {
  mode: ResearchMode;
  onRunResearch: () => void;
  ui: UiCopy;
}) {
  return (
    <section className="workspace-grid" aria-label={ui.workspaceAriaLabel}>
      <aside className="code-panel">
        <div className="panel-title">{mode.codeFile}</div>
        <pre>
          <code>{mode.codeSample}</code>
        </pre>
      </aside>
      <aside className="config-panel">
        <div className="panel-title">{mode.title}</div>
        {mode.sections[1].items.slice(0, 4).map((item) => (
          <label key={item}>
            {item} <b>{ui.ready}</b>
          </label>
        ))}
        <button data-testid="workspace-run-research" onClick={onRunResearch} type="button">
          {ui.runResearch}
        </button>
      </aside>
    </section>
  );
}

function StrategyTable({
  onSelectStrategy,
  selectedStrategyId,
  strategies,
  ui,
}: {
  onSelectStrategy?: (strategy: StrategyRow) => void;
  selectedStrategyId?: string;
  strategies: StrategyRow[];
  ui: UiCopy;
}) {
  const isInteractive = Boolean(onSelectStrategy);

  function handleStrategyClick(strategy: StrategyRow) {
    onSelectStrategy?.(strategy);
  }

  return (
    <section className="table-panel">
      <h3>{ui.strategyTableTitle}</h3>
      <table>
        <thead>
          <tr>
            <th>{ui.strategyTableHeaders.strategy}</th>
            <th>{ui.strategyTableHeaders.type}</th>
            <th>{ui.strategyTableHeaders.return}</th>
            <th>{ui.strategyTableHeaders.drawdown}</th>
            <th>{ui.strategyTableHeaders.sharpe}</th>
            <th>{ui.strategyTableHeaders.status}</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((strategy) => (
            <tr
              className={`${strategy.id === selectedStrategyId ? 'selected-row' : ''} ${
                isInteractive ? 'clickable-row' : ''
              }`}
              data-testid={isInteractive ? `strategy-row-${strategy.id}` : undefined}
              key={strategy.name}
              onClick={isInteractive ? () => handleStrategyClick(strategy) : undefined}
            >
              <td>
                <strong>{strategy.name}</strong>
                <span>{isInteractive ? ui.enterWorkspace : ui.strategySample}</span>
              </td>
              <td>{strategy.type}</td>
              <td>{strategy.return}</td>
              <td>{strategy.drawdown}</td>
              <td>{strategy.sharpe}</td>
              <td>
                <mark>{strategy.status}</mark>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TickTable({ ticks, ui }: { ticks: ReturnType<typeof getMarketTicks>; ui: UiCopy }) {
  return (
    <section className="table-panel">
      <h3>{ui.tickTableTitle}</h3>
      <table>
        <thead>
          <tr>
            <th>{ui.tickTableHeaders.time}</th>
            <th>{ui.tickTableHeaders.bid}</th>
            <th>{ui.tickTableHeaders.ask}</th>
            <th>{ui.tickTableHeaders.size}</th>
            <th>{ui.tickTableHeaders.signal}</th>
          </tr>
        </thead>
        <tbody>
          {ticks.map((tick) => (
            <tr key={tick.time}>
              <td>{tick.time}</td>
              <td>{tick.bid}</td>
              <td>{tick.ask}</td>
              <td>{tick.size}</td>
              <td>
                <mark>{tick.signal}</mark>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function AiDiagnostics({ ui }: { ui: UiCopy }) {
  return (
    <section className="table-panel">
      <h3>{ui.aiDiagnosticsTitle}</h3>
      <table>
        <thead>
          <tr>
            <th>{ui.aiTableHeaders.featureSet}</th>
            <th>{ui.aiTableHeaders.ic}</th>
            <th>{ui.aiTableHeaders.rankIc}</th>
            <th>{ui.aiTableHeaders.oosReturn}</th>
            <th>{ui.aiTableHeaders.risk}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>micro_price + flow_imbalance</td>
            <td>0.071</td>
            <td>0.094</td>
            <td>+6.8%</td>
            <td>
              <mark>{ui.aiRiskStable}</mark>
            </td>
          </tr>
          <tr>
            <td>factor_value + momentum</td>
            <td>0.046</td>
            <td>0.063</td>
            <td>+4.2%</td>
            <td>
              <mark>{ui.aiRiskWatch}</mark>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function JobList({ jobs }: { jobs: ResearchJob[] }) {
  return (
    <section className="job-list">
      {jobs.map((job) => (
        <article className="job-card" key={job.name}>
          <div>
            <span>{job.kind}</span>
            <strong>{job.name}</strong>
            <small>{job.state}</small>
          </div>
          <div className="progress" aria-label={`${job.progress}%`}>
            <i style={{ width: `${job.progress}%` }} />
          </div>
        </article>
      ))}
    </section>
  );
}

function WorkspaceModeTabs({
  activeMode,
  onChange,
  modes,
  ui,
}: {
  activeMode: ResearchModeId;
  onChange: (mode: ResearchModeId) => void;
  modes: ResearchMode[];
  ui: UiCopy;
}) {
  return (
    <section className="mode-tabs" aria-label={ui.modeTabsAriaLabel}>
      {modes.map((mode) => (
        <button
          className={mode.id === activeMode ? 'active' : ''}
          key={mode.id}
          onClick={() => onChange(mode.id)}
          type="button"
        >
          <span>{mode.label}</span>
          <small>{mode.title}</small>
        </button>
      ))}
    </section>
  );
}

function WorkspaceContent({
  mode,
  onRunResearch,
  strategies,
  ticks,
  ui,
}: {
  mode: ResearchMode;
  onRunResearch: () => void;
  strategies: StrategyRow[];
  ticks: ReturnType<typeof getMarketTicks>;
  ui: UiCopy;
}) {
  return (
    <>
      <section className="mode-summary">
        <div>
          <p>{ui.currentResearchMode}</p>
          <h2>{mode.title}</h2>
          <span>{mode.description}</span>
        </div>
        <div className="metric-grid compact">
          {mode.heroMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>
      <WorkspaceMockup mode={mode} onRunResearch={onRunResearch} ui={ui} />
      {mode.id === 'hft' ? (
        <TickTable ticks={ticks} ui={ui} />
      ) : mode.id === 'ai' ? (
        <AiDiagnostics ui={ui} />
      ) : (
        <StrategyTable strategies={strategies} ui={ui} />
      )}
    </>
  );
}

function DataPanel({
  activePage,
  jobs,
  onSelectStrategy,
  selectedStrategyId,
  strategies,
  ui,
}: {
  activePage: PageId;
  jobs: ResearchJob[];
  onSelectStrategy: (strategy: StrategyRow) => void;
  selectedStrategyId?: string;
  strategies: StrategyRow[];
  ui: UiCopy;
}) {
  if (activePage === 'jobs') {
    return <JobList jobs={jobs} />;
  }

  return (
    <StrategyTable
      onSelectStrategy={onSelectStrategy}
      selectedStrategyId={selectedStrategyId}
      strategies={strategies}
      ui={ui}
    />
  );
}

function LanguageSettings({
  language,
  onChange,
  ui,
}: {
  language: LanguageCode;
  onChange: (language: LanguageCode) => void;
  ui: UiCopy;
}) {
  return (
    <section className="language-panel">
      <div>
        <h3>{ui.languageTitle}</h3>
        <p>{ui.languageDescription}</p>
      </div>
      <div className="language-toggle" role="group" aria-label={ui.languageTitle}>
        {(['en', 'zh'] as const).map((option) => (
          <button
            className={language === option ? 'active' : ''}
            data-testid={`language-${option}`}
            key={option}
            onClick={() => onChange(option)}
            type="button"
          >
            {option === 'en' ? 'English' : '中文'}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function App() {
  const [state, setState] = useState<AppState>(() => createInitialState());
  const [language, setLanguage] = useState<LanguageCode>(() => getStoredLanguage());
  const [activeMode, setActiveMode] = useState<ResearchModeId>('traditional');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | undefined>();
  const [jobs, setJobs] = useState<ResearchJob[]>(() => getJobs(getStoredLanguage()));
  const navItems = useMemo(() => getNavItems(language), [language]);
  const ui = useMemo(() => getUiCopy(language), [language]);
  const strategies = useMemo(() => getStrategies(language), [language]);
  const ticks = useMemo(() => getMarketTicks(language), [language]);
  const researchModes = useMemo(() => getResearchModes(language), [language]);
  const activePage = useMemo(() => getPage(state.activePage, language), [state.activePage, language]);
  const researchMode = useMemo(() => getResearchMode(activeMode, language), [activeMode, language]);
  const localizedJobs = useMemo(() => jobs.map((job) => localizeResearchJob(job, language)), [jobs, language]);
  const selectedStrategyForLanguage = useMemo(
    () => strategies.find((strategy) => strategy.id === selectedStrategy?.id),
    [strategies, selectedStrategy?.id],
  );

  function handleNavClick(pageId: PageId) {
    setState((current) => ({ ...setActivePage({ ...current }, pageId) }));
  }

  function handleSelectStrategy(strategy: StrategyRow) {
    setSelectedStrategy(strategy);
    setActiveMode(strategy.mode);
    setState((current) => ({ ...setActivePage({ ...current }, 'workspace') }));
  }

  function handleRunResearch() {
    const nextJob = createResearchJob({
      id: `job-${Date.now()}`,
      mode: activeMode,
      sequence: jobs.length + 1,
      strategy: selectedStrategyForLanguage,
    }, language);

    setJobs((current) => [nextJob, ...current]);
    setState((current) => ({ ...setActivePage({ ...current }, 'jobs') }));
  }

  function handleLanguageChange(nextLanguage: LanguageCode) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  }

  const heroMetrics = state.activePage === 'workspace' ? researchMode.heroMetrics : activePage.heroMetrics;
  const sections = state.activePage === 'workspace' ? researchMode.sections : activePage.sections;

  return (
    <>
      <aside className="sidebar">
        <div className="brand">
            <span>Q</span>
          <div>
            <strong>QuantForge</strong>
            <small>{ui.brandTagline}</small>
          </div>
        </div>
        <nav aria-label={ui.navAriaLabel}>
          {navItems.map((item) => (
            <button
              className={`nav-item ${item.id === state.activePage ? 'active' : ''}`}
              data-page={item.id}
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              type="button"
            >
              <small>{item.eyebrow}</small>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
      <main className="main-shell">
        <header className="topbar">
          <div>
            <span className="status-light" />
            <span>{state.activePage === 'workspace' ? researchMode.description : activePage.status}</span>
          </div>
          <button className="primary-action" data-testid="run-research" onClick={handleRunResearch} type="button">
            {ui.runResearch}
          </button>
        </header>
        <section className="page-hero">
          <div>
            <p>{ui.heroEyebrow}</p>
            <h1>{state.activePage === 'workspace' ? researchMode.title : activePage.title}</h1>
            <span>{state.activePage === 'workspace' ? activePage.subtitle : activePage.subtitle}</span>
          </div>
          <div className="metric-grid">
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
        <section className="content-grid">
          <div className="primary-column">
            {state.activePage === 'workspace' ? (
              <WorkspaceContent
                mode={researchMode}
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
                  selectedStrategyId={selectedStrategy?.id}
                  strategies={strategies}
                  ui={ui}
                />
              </>
            )}
          </div>
          <div className="secondary-column">
            {sections.map((section) => (
              <InfoPanel key={section.title} section={section} />
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
