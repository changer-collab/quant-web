import type { MarketTick, ResearchMode, ResearchModeId, StrategyRow, UiCopy } from '../appData';
import { MetricCard } from './common';
import { AiDiagnostics, TickTable } from './market-tables';
import { StrategyTable } from './strategy-table';
import workspace from '../styles/workspace.module.css';
import modeTabsStyles from '../styles/mode-tabs.module.css';
import hero from '../styles/hero.module.css';
import buttons from '../styles/buttons.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';

function WorkspaceMockup({
  configSummary,
  mode,
  onRunResearch,
  ui,
}: {
  configSummary: string[];
  mode: ResearchMode;
  onRunResearch: () => void;
  ui: UiCopy;
}) {
  return (
    <section className={workspace.workspaceGrid} aria-label={ui.workspaceAriaLabel}>
      <aside className={workspace.codePanel}>
        <div className={workspace.panelTitle}>{mode.codeFile}</div>
        <pre className={workspace.codeBlock}>
          <code>{mode.codeSample}</code>
        </pre>
      </aside>
      <aside className={workspace.configPanel}>
        <div className={workspace.panelTitle}>{mode.title}</div>
        <div className={workspace.configList}>
          {mode.configItems.map((item) => (
            <article className={workspace.configItem} key={item.label}>
              <span className={workspace.configLabel}>{item.label}</span>
              <b className={workspace.configValue}>{item.value}</b>
              <small className={workspace.configDesc}>{item.description}</small>
            </article>
          ))}
        </div>
        <div className={workspace.runSummary}>
          <span className={workspace.runSummaryLabel}>{ui.currentRunSummary}</span>
          <div className={infoPanelStyles.chipRow}>
            {configSummary.map((item) => (
              <span className={infoPanelStyles.chip} key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <button className={buttons.workspaceRunButton} data-testid="workspace-run-research" onClick={onRunResearch} type="button">
          {ui.runResearch}
        </button>
      </aside>
    </section>
  );
}

export function WorkspaceModeTabs({
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
    <section className={modeTabsStyles.modeTabs} aria-label={ui.modeTabsAriaLabel}>
      {modes.map((mode) => (
        <button
          className={`${modeTabsStyles.modeTab} ${mode.id === activeMode ? modeTabsStyles.modeTabActive : ''}`}
          key={mode.id}
          onClick={() => onChange(mode.id)}
          type="button"
        >
          <span className={modeTabsStyles.modeTabLabel}>{mode.label}</span>
          <small className={modeTabsStyles.modeTabDesc}>{mode.title}</small>
        </button>
      ))}
    </section>
  );
}

export function WorkspaceContent({
  configSummary,
  mode,
  onRunResearch,
  strategies,
  ticks,
  ui,
}: {
  configSummary: string[];
  mode: ResearchMode;
  onRunResearch: () => void;
  strategies: StrategyRow[];
  ticks: MarketTick[];
  ui: UiCopy;
}) {
  return (
    <>
      <section className={modeTabsStyles.modeSummary}>
        <div>
          <p className={modeTabsStyles.modeSummaryEyebrow}>{ui.currentResearchMode}</p>
          <h2 className={modeTabsStyles.modeSummaryTitle}>{mode.title}</h2>
          <span className={modeTabsStyles.modeSummaryDesc}>{mode.description}</span>
        </div>
        <div className={`${hero.metricGrid} ${hero.metricGridCompact}`}>
          {mode.heroMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>
      <WorkspaceMockup configSummary={configSummary} mode={mode} onRunResearch={onRunResearch} ui={ui} />
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
