import type { MarketTick, MetricTone, StrategyRow, UiCopy } from '../appData';
import type { BacktestConfig } from '../hooks/useResearchWorkflow';
import { MetricCard } from './common';
import { AiDiagnostics, TickTable } from './market-tables';
import { StrategyTable } from './strategy-table';
import workspace from '../styles/workspace.module.css';
import modeTabsStyles from '../styles/mode-tabs.module.css';
import hero from '../styles/hero.module.css';
import buttons from '../styles/buttons.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';

// 日期工具函数
export function tsToDate(ts: number): string {
  if (!ts || ts <= 0) return '2023-01-01';
  const d = new Date(ts);
  return d.toISOString().slice(0, 10);
}

export function dateToTs(dateStr: string): number {
  if (!dateStr) return 0;
  return new Date(dateStr + 'T00:00:00').getTime();
}

function WorkspaceMockup({
  configSummary,
  mode,
  onRunResearch,
  selectedStrategy,
  backtestConfig,
  onConfigChange,
  ui,
}: {
  configSummary: string[];
  mode: {
    id: string;
    label: string;
    title: string;
    description: string;
    codeFile: string;
    codeSample: string;
    configItems: { label: string; value: string; description: string }[];
    heroMetrics: { label: string; value: string; tone: MetricTone }[];
    sections: { title: string; items: string[] }[];
  };
  onRunResearch: () => void;
  selectedStrategy?: StrategyRow;
  backtestConfig: BacktestConfig;
  onConfigChange: (config: BacktestConfig) => void;
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
        {selectedStrategy && (
          <div className={workspace.configList}>
            <div className={workspace.configItem}>
              <span className={workspace.configLabel}>标的代码</span>
              <input
                type="text"
                value={backtestConfig.symbol}
                onChange={(e) => onConfigChange({ ...backtestConfig, symbol: e.target.value })}
                className={workspace.configInput}
                placeholder="如 600519"
              />
            </div>
            <div className={workspace.configItem}>
              <span className={workspace.configLabel}>时间范围</span>
              <select
                value={backtestConfig.timeframe}
                onChange={(e) => onConfigChange({ ...backtestConfig, timeframe: e.target.value })}
                className={workspace.configInput}
              >
                <option value="1d">日线</option>
                <option value="1w">周线</option>
                <option value="1h">小时</option>
              </select>
            </div>
            <div className={workspace.configItem}>
              <span className={workspace.configLabel}>起始日期</span>
              <input
                type="date"
                value={tsToDate(backtestConfig.startTs)}
                onChange={(e) =>
                  onConfigChange({ ...backtestConfig, startTs: dateToTs(e.target.value) })
                }
                className={workspace.configInput}
              />
            </div>
            <div className={workspace.configItem}>
              <span className={workspace.configLabel}>结束日期</span>
              <input
                type="date"
                value={tsToDate(backtestConfig.endTs)}
                onChange={(e) =>
                  onConfigChange({ ...backtestConfig, endTs: dateToTs(e.target.value) })
                }
                className={workspace.configInput}
              />
            </div>
            <div className={workspace.configItem}>
              <span className={workspace.configLabel}>初始资金</span>
              <input
                type="number"
                value={backtestConfig.initialCash}
                onChange={(e) =>
                  onConfigChange({ ...backtestConfig, initialCash: Number(e.target.value) })
                }
                className={workspace.configInput}
              />
            </div>
            {(selectedStrategy.params ?? []).map((param) => (
              <div className={workspace.configItem} key={param.name}>
                <span className={workspace.configLabel}>{param.label}</span>
                <input
                  type={param.type === 'number' ? 'number' : 'text'}
                  value={String(backtestConfig.params[param.name] ?? param.default)}
                  onChange={(e) => {
                    const val = param.type === 'number' ? Number(e.target.value) : e.target.value;
                    onConfigChange({
                      ...backtestConfig,
                      params: { ...backtestConfig.params, [param.name]: val },
                    });
                  }}
                  className={workspace.configInput}
                  min={param.min}
                  max={param.max}
                />
              </div>
            ))}
          </div>
        )}
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
        <button
          className={buttons.workspaceRunButton}
          data-testid="workspace-run-research"
          onClick={onRunResearch}
          type="button"
        >
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
}: {
  activeMode: string;
  onChange: (mode: string) => void;
  modes: { id: string; label: string; title: string }[];
}) {
  return (
    <section className={modeTabsStyles.modeTabs} aria-label="Strategy research modes">
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
  selectedStrategy,
  backtestConfig,
  onConfigChange,
  ticks,
  ui,
}: {
  configSummary: string[];
  mode: {
    id: string;
    label: string;
    title: string;
    description: string;
    codeFile: string;
    codeSample: string;
    configItems: { label: string; value: string; description: string }[];
    heroMetrics: { label: string; value: string; tone: MetricTone }[];
    sections: { title: string; items: string[] }[];
  };
  onRunResearch: () => void;
  strategies: StrategyRow[];
  selectedStrategy?: StrategyRow;
  backtestConfig: BacktestConfig;
  onConfigChange: (config: BacktestConfig) => void;
  ticks: MarketTick[];
  ui: UiCopy;
}) {
  return (
    <>
      <section className={modeTabsStyles.modeSummary}>
        <div>
          <p className={modeTabsStyles.modeSummaryEyebrow}>Current Research Mode</p>
          <h2 className={modeTabsStyles.modeSummaryTitle}>{mode.title}</h2>
          <span className={modeTabsStyles.modeSummaryDesc}>{mode.description}</span>
        </div>
        <div className={`${hero.metricGrid} ${hero.metricGridCompact}`}>
          {mode.heroMetrics.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </div>
      </section>
      <WorkspaceMockup
        configSummary={configSummary}
        mode={mode}
        onRunResearch={onRunResearch}
        selectedStrategy={selectedStrategy}
        backtestConfig={backtestConfig}
        onConfigChange={onConfigChange}
        ui={ui}
      />
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
