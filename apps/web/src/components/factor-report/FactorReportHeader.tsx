import type { FactorReportFull, FactorGrade, FactorReportUiCopy } from '../../appData';
import s from '../../styles/factor-report.module.css';

interface FactorReportHeaderProps {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
  onBack?: () => void;
}

const gradeClass: Record<FactorGrade, string> = {
  A: s.gradeA,
  B: s.gradeB,
  C: s.gradeC,
  D: s.gradeD,
};

export function FactorReportHeader({ report, ui, onBack }: FactorReportHeaderProps) {
  const grade = report.conclusion.grade;

  return (
    <header className={s.reportHeader}>
      <div className={s.reportHeaderLeft}>
        {onBack && (
          <button className={s.backButton} onClick={onBack} type="button">
            ← {ui.conclusion.title}
          </button>
        )}
        <p className={s.reportEyebrow}>{ui.basicInfo.title}</p>
        <h2 className={s.reportTitle}>{report.factorName}</h2>
        <p className={s.reportMeta}>
          {ui.basicInfo.reportDate}: {report.generatedAt} &nbsp;|&nbsp;
          {ui.basicInfo.backtestRange}: {report.basicInfo.backtestRange.start} ~ {report.basicInfo.backtestRange.end}
        </p>
      </div>
      <div className={`${s.gradeBadge} ${gradeClass[grade]}`}>{grade}</div>
    </header>
  );
}
