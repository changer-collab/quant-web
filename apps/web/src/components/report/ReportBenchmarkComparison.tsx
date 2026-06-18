import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-benchmark.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

export function ReportBenchmarkComparison({ report, ui }: Props) {
  const rows = report.benchmarkComparison.rows;
  const labels = ui.benchmarkComparison;

  return (
    <section className={styles.panel}>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{labels.metric}</th>
              <th>{labels.strategy}</th>
              <th>{labels.benchmark}</th>
              <th>{labels.excess}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPositiveExcess = row.excess.startsWith('+');
              const isNegativeExcess = row.excess.startsWith('-');
              return (
                <tr key={row.metric}>
                  <td className={styles.metricCell}>{row.metric}</td>
                  <td className={styles.strategyCell}>{row.strategy}</td>
                  <td className={styles.benchmarkCell}>{row.benchmark}</td>
                  <td
                    className={`${styles.excessCell} ${
                      isPositiveExcess ? styles.excessPos : isNegativeExcess ? styles.excessNeg : ''
                    }`}
                  >
                    {row.excess}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
