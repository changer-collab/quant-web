import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorTurnoverCost({ report, ui }: Props) {
  const turnover = report.turnover;
  const u = ui.turnoverCost;

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.monthlyTurnover}</div>
          <div className={s.kpiValue}>{(turnover.monthlyTurnover * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.quarterlyTurnover}</div>
          <div className={s.kpiValue}>{(turnover.quarterlyTurnover * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.singleSideTurnover}</div>
          <div className={s.kpiValue}>{(turnover.singleSideTurnover * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.doubleSideTurnover}</div>
          <div className={s.kpiValue}>{(turnover.doubleSideTurnover * 100).toFixed(1)}%</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.topHoldingOverlap}</div>
          <div className={`${s.kpiValue} ${s.positive}`}>
            {(turnover.topHoldingOverlap * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <FactorReportSection title={u.costSensitivity} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr>
              <th>Fee (bps)</th>
              <th>NAV Impact</th>
            </tr>
          </thead>
          <tbody>
            {turnover.costSensitivity.map((c, i) => (
              <tr key={i}>
                <td>{c.feeBps}</td>
                <td className={c.navImpact < 0 ? s.alertCritical : s.alertNormal}>
                  {(c.navImpact * 100).toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>
    </>
  );
}
