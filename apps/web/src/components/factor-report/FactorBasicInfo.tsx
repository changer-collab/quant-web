import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorBasicInfo({ report, ui }: Props) {
  const { basicInfo } = report;
  const u = ui.basicInfo;

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.name}</div>
          <div className={s.kpiValue}>{basicInfo.name}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.category}</div>
          <div className={s.kpiValue}>{basicInfo.category}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.version}</div>
          <div className={s.kpiValue}>{basicInfo.version}</div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>{u.reportDate}</div>
          <div className={s.kpiValue}>{basicInfo.reportDate}</div>
        </div>
      </div>

      <FactorReportSection title={u.dataSource} defaultOpen={true}>
        <p style={{ color: 'var(--text)', fontSize: 'var(--text-sm)' }}>{basicInfo.dataSource}</p>
        <p style={{ color: 'var(--muted)', fontSize: 'var(--text-xs)', marginTop: 4 }}>{u.updateFrequency}: {basicInfo.updateFrequency}</p>
      </FactorReportSection>

      <FactorReportSection title={u.formula} defaultOpen={true}>
        <div className={s.formulaBlock}>{basicInfo.formula}</div>
      </FactorReportSection>

      <FactorReportSection title={u.params} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {basicInfo.params.map((p) => (
              <tr key={p.label}>
                <td>{p.label}</td>
                <td>{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title={u.processing} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr>
              <th>Step</th>
              <th>Method</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>Standardization</td><td>{basicInfo.processing.standardization}</td></tr>
            <tr><td>Winsorization</td><td>{basicInfo.processing.winsorization}</td></tr>
            <tr><td>Neutralization</td><td>{basicInfo.processing.neutralization}</td></tr>
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title={u.backtestRange} defaultOpen={false}>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Start</div>
            <div className={s.kpiValue}>{basicInfo.backtestRange.start}</div>
          </div>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>End</div>
            <div className={s.kpiValue}>{basicInfo.backtestRange.end}</div>
          </div>
        </div>
      </FactorReportSection>
    </>
  );
}
