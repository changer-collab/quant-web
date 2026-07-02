import type { UiCopy } from '../appData';
import s from '../styles/experiment-table.module.css';

interface ExperimentRow {
  id: string;
  name: string;
  strategy: string;
  params: string;
  return: string;
  drawdown: string;
  sharpe: string;
  ic: string;
  stability: string;
  isBest: boolean;
}

const MOCK_EXPERIMENTS: ExperimentRow[] = [
  {
    id: 'exp-1',
    name: 'Fee stress 8bp',
    strategy: 'Order Flow Momentum',
    params: '8bp fee · 1.2bp slip',
    return: '+28.4%',
    drawdown: '-7.1%',
    sharpe: '2.01',
    ic: '—',
    stability: 'A',
    isBest: false,
  },
  {
    id: 'exp-2',
    name: 'Fee stress 12bp',
    strategy: 'Order Flow Momentum',
    params: '12bp fee · 1.2bp slip',
    return: '+24.6%',
    drawdown: '-8.9%',
    sharpe: '1.74',
    ic: '—',
    stability: 'B+',
    isBest: false,
  },
  {
    id: 'exp-3',
    name: 'Liquidity regime test',
    strategy: 'Cancel Spike Arbitrage',
    params: 'liquid · 25ms latency',
    return: '+18.7%',
    drawdown: '-10.2%',
    sharpe: '1.51',
    ic: '—',
    stability: 'B',
    isBest: false,
  },
  {
    id: 'exp-4',
    name: 'Feature set A',
    strategy: 'AI Alpha Mining',
    params: 'price+volume · XGB',
    return: '+27.1%',
    drawdown: '-7.8%',
    sharpe: '1.94',
    ic: '0.071',
    stability: 'A-',
    isBest: false,
  },
  {
    id: 'exp-5',
    name: 'Feature set B',
    strategy: 'AI Alpha Mining',
    params: 'all+micro · XGB',
    return: '+31.2%',
    drawdown: '-6.1%',
    sharpe: '2.32',
    ic: '0.083',
    stability: 'A',
    isBest: true,
  },
  {
    id: 'exp-6',
    name: 'Window 2019-2024',
    strategy: 'Multi-Factor Selection',
    params: '5yr · daily rebalance',
    return: '+21.4%',
    drawdown: '-7.4%',
    sharpe: '1.72',
    ic: '—',
    stability: 'A-',
    isBest: false,
  },
];

export function ExperimentTable({ ui }: { ui: UiCopy }) {
  return (
    <section className={s.panel}>
      <h3>{ui.experimentTableTitle}</h3>
      {MOCK_EXPERIMENTS.length === 0 ? (
        <p className={s.empty}>{ui.experimentEmpty}</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>Experiment</th>
              <th>Strategy</th>
              <th>Parameters</th>
              <th>Return</th>
              <th>DD</th>
              <th>Sharpe</th>
              <th>IC</th>
              <th>Stability</th>
            </tr>
          </thead>
          <tbody>
            {MOCK_EXPERIMENTS.map((exp) => (
              <tr key={exp.id} className={exp.isBest ? s.best : ''}>
                <td>
                  <strong>{exp.name}</strong>
                </td>
                <td>{exp.strategy}</td>
                <td style={{ color: 'var(--muted)', fontSize: 12 }}>{exp.params}</td>
                <td className={s.good}>{exp.return}</td>
                <td className={s.warn}>{exp.drawdown}</td>
                <td>{exp.sharpe}</td>
                <td>{exp.ic}</td>
                <td>{exp.stability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
