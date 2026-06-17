import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorMultiFactor({ report, ui }: Props) {
  const mf = report.multiFactor;
  const u = ui.multiFactor;

  return (
    <>
      <FactorReportSection title={u.weightInModel} defaultOpen={true}>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Weight in Model</div>
            <div className={`${s.kpiValue} ${s.positive}`}>{(mf.weightInModel * 100).toFixed(1)}%</div>
          </div>
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.marginalIcImprovement} defaultOpen={true}>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>IC Improvement</div>
            <div className={`${s.kpiValue} ${mf.marginalIcImprovement > 0 ? s.positive : s.negative}`}>
              {mf.marginalIcImprovement > 0 ? '+' : ''}{mf.marginalIcImprovement.toFixed(3)}
            </div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Sharpe Improvement</div>
            <div className={`${s.kpiValue} ${mf.marginalSharpeImprovement > 0 ? s.positive : s.negative}`}>
              {mf.marginalSharpeImprovement > 0 ? '+' : ''}{mf.marginalSharpeImprovement.toFixed(2)}
            </div>
          </div>
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.interactionEffects} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr><th>With Factor</th><th>Interaction Effect</th></tr>
          </thead>
          <tbody>
            {mf.interactionEffects.map((ie, i) => (
              <tr key={i}>
                <td>{ie.withFactor}</td>
                <td className={ie.effect > 0 ? s.alertNormal : s.alertCritical}>
                  {ie.effect.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>
    </>
  );
}
