import type { ResearchModeId, StrategyRow, UiCopy } from '../appData';
import s from '../styles/strategy-grid.module.css';

function statusMod(status: string) {
  const lower = status.toLowerCase();
  if (lower.includes('stable') || lower.includes('稳定') || lower.includes('running') || lower.includes('运行')) return s.statusGreen;
  if (lower.includes('research') || lower.includes('研究') || lower.includes('training') || lower.includes('训练')) return s.statusAmber;
  if (lower.includes('draft') || lower.includes('草稿')) return s.statusRed;
  return '';
}

const MODE_ORDER: ResearchModeId[] = ['traditional', 'hft', 'ai'];

export function StrategyGrid({
  strategies,
  onSelectStrategy,
  selectedStrategyId,
  ui,
}: {
  strategies: StrategyRow[];
  onSelectStrategy?: (strategy: StrategyRow) => void;
  selectedStrategyId?: string;
  ui: UiCopy;
}) {
  const grouped = MODE_ORDER.map((mode) => ({
    mode,
    label: ui.strategyGridModeLabels[mode],
    items: strategies.filter((s) => s.mode === mode),
  }));

  return (
    <section className={s.panel}>
      <h3>{ui.strategyTableTitle}</h3>
      {strategies.length === 0 ? (
        <p className={s.empty}>{ui.emptyStrategies}</p>
      ) : (
        grouped.map((group) =>
          group.items.length > 0 ? (
            <div className={s.section} key={group.mode}>
              <div className={s.sectionHeader}>
                <span>{group.label}</span>
                <span className={s.sectionLine} />
                <span>{group.items.length}</span>
              </div>
              <div className={s.grid}>
                {group.items.map((strategy) => (
                  <div
                    className={`${s.card} ${strategy.id === selectedStrategyId ? s.cardSelected : ''}`}
                    key={strategy.id}
                    onClick={onSelectStrategy ? () => onSelectStrategy(strategy) : undefined}
                  >
                    <span className={`${s.status} ${statusMod(strategy.status)}`}>
                      {strategy.status}
                    </span>
                    <div className={s.cardName}>{strategy.name}</div>
                    <span className={s.cardType}>{strategy.type}</span>
                    {strategy.description && (
                      <p className={s.cardDesc}>{strategy.description}</p>
                    )}
                    {strategy.params && strategy.params.length > 0 && (
                      <div className={s.paramList}>
                        {strategy.params.map((p) => (
                          <span className={s.paramChip} key={p.key}>
                            {p.label}: <b>{String(p.default)}</b>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className={s.cardMetrics}>
                      <div className={s.metric}>
                        <span className={`${s.metricValue} ${s.metricGreen}`}>
                          {strategy.return}
                        </span>
                        <span className={s.metricLabel}>Return</span>
                      </div>
                      <div className={s.metric}>
                        <span className={`${s.metricValue} ${s.metricWarn}`}>
                          {strategy.drawdown}
                        </span>
                        <span className={s.metricLabel}>DD</span>
                      </div>
                      <div className={s.metric}>
                        <span className={s.metricValue}>{strategy.sharpe}</span>
                        <span className={s.metricLabel}>Sharpe</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null,
        )
      )}
    </section>
  );
}