import type { StrategyRow, UiCopy } from '../appData';
import table from '../styles/table.module.css';

export function StrategyTable({
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
    <section className={table.tablePanel}>
      <h3>{ui.strategyTableTitle}</h3>
      <table>
        <thead>
          <tr>
            <th>{ui.strategyTableHeaders.strategy}</th>
            <th>{ui.strategyTableHeaders.type}</th>
            <th>参数</th>
            <th>{ui.strategyTableHeaders.return}</th>
            <th>{ui.strategyTableHeaders.drawdown}</th>
            <th>{ui.strategyTableHeaders.sharpe}</th>
            <th>{ui.strategyTableHeaders.status}</th>
          </tr>
        </thead>
        <tbody>
          {strategies.map((strategy) => (
            <tr
              className={`${strategy.id === selectedStrategyId ? table.selectedRow : ''} ${
                isInteractive ? table.clickableRow : ''
              }`}
              data-testid={isInteractive ? `strategy-row-${strategy.id}` : undefined}
              key={strategy.id}
              onClick={isInteractive ? () => handleStrategyClick(strategy) : undefined}
            >
              <td>
                <strong>{strategy.name}</strong>
                <span>{isInteractive ? ui.enterWorkspace : ui.strategySample}</span>
              </td>
              <td>{strategy.type}</td>
              <td>
                {strategy.params && strategy.params.length > 0 ? (
                  <div className={table.paramCell}>
                    {strategy.params.map((p) => (
                      <span className={table.paramChip} key={p.name}>
                        {p.label}={String(p.default)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className={table.paramMuted}>—</span>
                )}
              </td>
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
