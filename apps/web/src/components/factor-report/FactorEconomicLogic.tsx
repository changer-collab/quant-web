import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorEconomicLogic({ report, ui }: Props) {
  const econ = report.economicLogic;
  const u = ui.economicLogic;

  const snoopingColor =
    econ.dataSnoopingRisk === 'low'
      ? s.alertNormal
      : econ.dataSnoopingRisk === 'medium'
        ? s.alertWarning
        : s.alertCritical;

  return (
    <>
      <FactorReportSection title={u.economicExplanation} defaultOpen={true}>
        <div className={s.textBlock}>{econ.economicExplanation}</div>
      </FactorReportSection>

      <FactorReportSection title={u.literatureRefs} defaultOpen={true}>
        <ul className={s.literatureList}>
          {econ.literatureRefs.map((lit, i) => (
            <li key={i} className={s.literatureItem}>
              {lit}
            </li>
          ))}
        </ul>
      </FactorReportSection>

      <FactorReportSection title={u.aShareSpecific} defaultOpen={true}>
        <div className={s.textBlock}>{econ.aShareSpecific}</div>
      </FactorReportSection>

      <FactorReportSection title={u.dataSnoopingRisk} defaultOpen={true}>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Data Snooping Risk</div>
            <div className={`${s.kpiValue} ${snoopingColor}`}>
              {econ.dataSnoopingRisk.toUpperCase()}
            </div>
          </div>
        </div>
      </FactorReportSection>
    </>
  );
}
