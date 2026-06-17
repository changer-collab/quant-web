import type { UiCopy } from '../appData';
import s from '../styles/data-coverage.module.css';

interface MarketRow {
  market: string;
  instruments: number;
  coverage: string;
  tickSince: string;
  lastSync: string;
}

const MOCK_MARKETS: MarketRow[] = [
  { market: 'CSI 500', instruments: 512, coverage: '99.1%', tickSince: '2019-06', lastSync: '14:28:09' },
  { market: 'CSI 300', instruments: 306, coverage: '98.7%', tickSince: '2019-01', lastSync: '14:27:55' },
  { market: 'CSI 1000', instruments: 1004, coverage: '97.3%', tickSince: '2020-03', lastSync: '14:26:40' },
  { market: 'SSE Main Board', instruments: 1692, coverage: '96.8%', tickSince: '2018-07', lastSync: '14:25:12' },
  { market: 'SZSE SME', instruments: 1002, coverage: '95.2%', tickSince: '2019-11', lastSync: '14:24:30' },
  { market: 'Star Market', instruments: 296, coverage: '93.4%', tickSince: '2021-04', lastSync: '14:23:18' },
];

function barClass(coverage: string) {
  const num = parseFloat(coverage);
  if (num >= 98) return s.barFill;
  if (num >= 95) return s.barFillMid;
  return s.barFillLow;
}

export function DataCoveragePanel({ ui }: { ui: UiCopy }) {
  return (
    <section className={s.panel}>
      <h3>{ui.dataCoverageTitle}</h3>

      {/* Summary stats */}
      <div className={s.summaryRow}>
        <div className={s.statCard}>
          <span className={`${s.statValue} ${s.statGreen}`}>4,812</span>
          <span className={s.statLabel}>{ui.dataCoverageFields.instruments}</span>
        </div>
        <div className={s.statCard}>
          <span className={`${s.statValue} ${s.statCyan}`}>2018</span>
          <span className={s.statLabel}>{ui.dataCoverageFields.tickSince}</span>
        </div>
        <div className={s.statCard}>
          <span className={`${s.statValue} ${s.statGreen}`}>99.1%</span>
          <span className={s.statLabel}>{ui.dataCoverageFields.minuteCoverage}</span>
        </div>
        <div className={s.statCard}>
          <span className={`${s.statValue} ${s.statWarn}`}>0.6%</span>
          <span className={s.statLabel}>{ui.dataCoverageFields.gaps}</span>
        </div>
      </div>

      {/* Market coverage table */}
      <table className={s.coverageTable}>
        <thead>
          <tr>
            <th>{ui.dataCoverageFields.market}</th>
            <th>{ui.dataCoverageFields.instruments}</th>
            <th>{ui.dataCoverageFields.coverage}</th>
            <th>{ui.dataCoverageFields.tickSince}</th>
            <th>{ui.dataCoverageFields.lastSync}</th>
          </tr>
        </thead>
        <tbody>
          {MOCK_MARKETS.map((row) => (
            <tr key={row.market}>
              <td><strong>{row.market}</strong></td>
              <td>{row.instruments.toLocaleString()}</td>
              <td>
                <div className={s.bar}>
                  <div className={s.barTrack}>
                    <i
                      className={`${s.barFill} ${barClass(row.coverage)}`}
                      style={{ width: row.coverage }}
                    />
                  </div>
                  <span className={s.barLabel}>{row.coverage}</span>
                </div>
              </td>
              <td>{row.tickSince}</td>
              <td>
                <span className={s.syncDot} />
                {row.lastSync}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}