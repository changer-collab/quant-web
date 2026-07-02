import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorRiskAnalysis({ report, ui }: Props) {
  const risk = report.risk;
  const u = ui.riskAnalysis;
  const maxExposure = Math.max(...risk.exposures.map((e) => Math.abs(e.exposure)), 0.001);

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.factorVolatility}</div>
          <div className={s.kpiValue}>{(risk.factorVolatility * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.maxDrawdown}</div>
          <div className={`${s.kpiValue} ${s.negative}`}>
            {(risk.maxDrawdown * 100).toFixed(1)}%
          </div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.maxDrawdownDuration}</div>
          <div className={s.kpiValue}>{risk.maxDrawdownDuration}d</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.negativeMonthRatio}</div>
          <div className={s.kpiValue}>{(risk.negativeMonthRatio * 100).toFixed(0)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>VaR 95%</div>
          <div className={`${s.kpiValue} ${s.negative}`}>{(risk.var95 * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>CVaR 95%</div>
          <div className={`${s.kpiValue} ${s.negative}`}>{(risk.cvar95 * 100).toFixed(1)}%</div>
        </div>
      </div>

      <FactorReportSection title={u.regimePerformance} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr>
              <th>Regime</th>
              <th>Return</th>
              <th>Sharpe</th>
              <th>Max DD</th>
            </tr>
          </thead>
          <tbody>
            {risk.regimePerformance.map((r) => (
              <tr key={r.regime}>
                <td>{r.regime}</td>
                <td className={r.return >= 0 ? s.alertNormal : s.alertCritical}>
                  {(r.return * 100).toFixed(1)}%
                </td>
                <td>{r.sharpe.toFixed(2)}</td>
                <td>{(r.drawdown * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title={u.exposures} defaultOpen={true}>
        <div className={s.barChartHorizontal}>
          {risk.exposures.map((e) => (
            <div key={e.factor} className={s.barRow}>
              <span className={s.barLabel}>{e.factor}</span>
              <div className={s.barTrack}>
                <div
                  className={`${s.barFill} ${e.exposure < 0 ? s.negative : ''}`}
                  style={{ width: `${(Math.abs(e.exposure) / maxExposure) * 100}%` }}
                />
              </div>
              <span className={s.barValue}>{e.exposure.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </FactorReportSection>
    </>
  );
}
