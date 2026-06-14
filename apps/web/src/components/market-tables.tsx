import type { MarketTick, UiCopy } from '../appData';
import table from '../styles/table.module.css';

export function TickTable({ ticks, ui }: { ticks: MarketTick[]; ui: UiCopy }) {
  return (
    <section className={table.tablePanel}>
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

export function AiDiagnostics({ ui }: { ui: UiCopy }) {
  return (
    <section className={table.tablePanel}>
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
