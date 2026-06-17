import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

interface DomainRow {
  label: string;
  ic: number;
  groupReturn: number;
}

function DomainTable({ rows }: { rows: DomainRow[] }) {
  const maxAbsIc = Math.max(...rows.map((r) => Math.abs(r.ic)), 0.001);
  const maxAbsReturn = Math.max(...rows.map((r) => Math.abs(r.groupReturn)), 0.001);

  return (
    <div className={s.gridTable3}>
      <div className={s.gridTableHeader}>
        <span className={s.colLabel}>Domain</span>
        <span className={s.colValue}>IC</span>
        <span className={s.colValue}>Group Return</span>
      </div>
      {rows.map((row, i) => (
        <div key={i} className={s.gridTableRow}>
          <span className={s.colLabel}>{row.label}</span>
          <span className={s.domainValueCell}>
            <span
              className={s.domainInlineBar}
              style={{
                width: `${(Math.abs(row.ic) / maxAbsIc) * 60}px`,
                background: row.ic >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            />
            <span className={`${s.colValue} ${row.ic > 0 ? s.alertNormal : s.alertCritical}`}>
              {row.ic.toFixed(3)}
            </span>
          </span>
          <span className={s.domainValueCell}>
            <span
              className={s.domainInlineBar}
              style={{
                width: `${(Math.abs(row.groupReturn) / maxAbsReturn) * 60}px`,
                background: row.groupReturn >= 0 ? 'var(--green)' : 'var(--red)',
              }}
            />
            <span className={`${s.colValue} ${row.groupReturn >= 0 ? s.alertNormal : s.alertCritical}`}>
              {(row.groupReturn * 100).toFixed(1)}%
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

export function FactorDomainAnalysis({ report, ui }: Props) {
  const domain = report.domain;
  const u = ui.domainAnalysis;

  const sections: { title: string; rows: DomainRow[] }[] = [
    { title: u.byCap, rows: domain.byCap.map((d) => ({ label: d.cap, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byIndustry, rows: domain.byIndustry.map((d) => ({ label: d.industry, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byRegime, rows: domain.byRegime.map((d) => ({ label: d.regime, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byValuation, rows: domain.byValuation.map((d) => ({ label: d.level, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byLiquidity, rows: domain.byLiquidity.map((d) => ({ label: d.level, ic: d.ic, groupReturn: d.groupReturn })) },
    { title: u.byBoard, rows: domain.byBoard.map((d) => ({ label: d.board, ic: d.ic, groupReturn: d.groupReturn })) },
  ];

  return (
    <div className={s.domainGrid}>
      {sections.map((sec) => (
        <div key={sec.title} className={s.domainCard}>
          <div className={s.domainCardTitle}>{sec.title}</div>
          <DomainTable rows={sec.rows} />
        </div>
      ))}
    </div>
  );
}
