import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorDescriptiveStats({ report, ui }: Props) {
  const { descriptiveStats } = report;
  const u = ui.descriptiveStats;
  const maxCount = Math.max(...descriptiveStats.distributionBins.map((b) => b.count));

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.mean}</div>
          <div className={s.kpiValue}>{descriptiveStats.mean.toFixed(3)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.std}</div>
          <div className={s.kpiValue}>{descriptiveStats.std.toFixed(3)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.median}</div>
          <div className={s.kpiValue}>{descriptiveStats.median.toFixed(3)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.skewness}</div>
          <div className={s.kpiValue}>{descriptiveStats.skewness.toFixed(2)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.kurtosis}</div>
          <div className={s.kpiValue}>{descriptiveStats.kurtosis.toFixed(2)}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.missingRatio}</div>
          <div className={s.kpiValue}>{(descriptiveStats.missingRatio * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.coverage}</div>
          <div className={s.kpiValue}>{(descriptiveStats.coverage * 100).toFixed(0)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.timeSeriesStability}</div>
          <div className={s.kpiValue}>{descriptiveStats.timeSeriesStability.toFixed(2)}</div>
        </div>
      </div>

      <FactorReportSection title={u.percentiles} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr><th>P5</th><th>P25</th><th>P75</th><th>P95</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>{descriptiveStats.percentiles.p5.toFixed(3)}</td>
              <td>{descriptiveStats.percentiles.p25.toFixed(3)}</td>
              <td>{descriptiveStats.percentiles.p75.toFixed(3)}</td>
              <td>{descriptiveStats.percentiles.p95.toFixed(3)}</td>
            </tr>
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title={u.coverageByCap} defaultOpen={true}>
        <div className={s.barChartHorizontal}>
          {descriptiveStats.coverageByCap.map((item) => (
            <div key={item.cap} className={s.barRow}>
              <span className={s.barLabel}>{item.cap}</span>
              <div className={s.barTrack}>
                <div className={s.barFill} style={{ width: `${item.coverage * 100}%` }} />
              </div>
              <span className={s.barValue}>{(item.coverage * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.distribution} defaultOpen={true}>
        <div className={s.barChartVertical}>
          {descriptiveStats.distributionBins.map((bin) => (
            <div
              key={bin.bin}
              className={s.vBar}
              style={{ height: `${(bin.count / maxCount) * 100}%` }}
              title={`${bin.bin}: ${bin.count}`}
            >
              <span className={s.vBarLabel}>{bin.bin}</span>
            </div>
          ))}
        </div>
      </FactorReportSection>
    </>
  );
}
