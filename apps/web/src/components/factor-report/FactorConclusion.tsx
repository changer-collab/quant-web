import type { FactorReportFull, FactorGrade, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

const gradeClass: Record<FactorGrade, string> = {
  A: s.gradeA,
  B: s.gradeB,
  C: s.gradeC,
  D: s.gradeD,
};

export function FactorConclusion({ report, ui }: Props) {
  const conc = report.conclusion;
  const u = ui.conclusion;

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.grade}</div>
          <div className={`${s.kpiValue} ${gradeClass[conc.grade]}`}>{conc.grade}</div>
        </div>
      </div>

      <FactorReportSection title={u.gradeReason} defaultOpen={true}>
        <div className={s.textBlock}>{conc.gradeReason}</div>
      </FactorReportSection>

      <FactorReportSection title={u.recommendedScenarios} defaultOpen={true}>
        <div>
          {conc.recommendedScenarios.map((scenario) => (
            <span key={scenario} className={s.chip}>
              {scenario}
            </span>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.riskWarnings} defaultOpen={true}>
        <div>
          {conc.riskWarnings.map((warning) => (
            <span key={warning} className={`${s.chip} ${s.chipWarn}`}>
              {warning}
            </span>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.nextActions} defaultOpen={true}>
        <div>
          {conc.nextActions.map((step) => (
            <span key={step} className={s.chip}>
              {step}
            </span>
          ))}
        </div>
      </FactorReportSection>
    </>
  );
}
