import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorNeutralization({ report, ui }: Props) {
  const neut = report.neutralization;
  const u = ui.neutralization;

  return (
    <div className={s.neutGrid}>
      {/* Raw vs Neutralized */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.rawVsNeutralized}</div>
        <div className={s.gridTable3}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Metric</span>
            <span className={s.colValue}>Raw</span>
            <span className={s.colValue}>Neutralized</span>
          </div>
          {neut.rawVsNeutralized.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.metric}</span>
              <span className={s.colValue}>{row.raw.toFixed(3)}</span>
              <span
                className={`${s.colValue} ${row.neutralized >= row.raw ? s.alertNormal : s.alertCritical}`}
              >
                {row.neutralized.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pure Alpha IC */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.pureAlphaIc}</div>
        <div className={s.gridTable2}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Orthogonal To</span>
            <span className={s.colValue}>IC</span>
          </div>
          {neut.pureAlphaIc.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.orthogonalTo}</span>
              <span className={`${s.colValue} ${row.ic > 0 ? s.alertNormal : s.alertCritical}`}>
                {row.ic.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Redundancy Matrix */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.redundancyMatrix}</div>
        <div className={s.gridTable3}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Factor A</span>
            <span className={s.colLabel}>Factor B</span>
            <span className={s.colValue}>Correlation</span>
          </div>
          {neut.redundancyMatrix.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.factorA}</span>
              <span className={s.colLabel}>{row.factorB}</span>
              <span
                className={`${s.colValue} ${Math.abs(row.correlation) > 0.5 ? s.alertWarning : s.alertNormal}`}
              >
                {row.correlation.toFixed(3)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* VIF */}
      <div className={s.neutCard}>
        <div className={s.neutCardTitle}>{u.vif}</div>
        <div className={s.gridTable2}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Factor</span>
            <span className={s.colValue}>VIF</span>
          </div>
          {neut.vif.map((row, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{row.factor}</span>
              <span className={`${s.colValue} ${row.vif > 5 ? s.negative : s.positive}`}>
                {row.vif.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
