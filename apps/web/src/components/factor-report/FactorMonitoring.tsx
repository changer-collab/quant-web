import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorMonitoring({ report, ui }: Props) {
  const mon = report.monitoring;
  const u = ui.monitoring;

  function statusClass(status: string) {
    if (status === 'normal') return s.alertNormal;
    if (status === 'warning') return s.alertWarning;
    return s.alertCritical;
  }

  function statusLabel(status: string) {
    if (status === 'normal') return 'Normal';
    if (status === 'warning') return 'Warning';
    return 'Critical';
  }

  return (
    <>
      <div className={s.kpiGrid}>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Realtime IC</div>
          <div
            className={`${s.kpiValue} ${mon.realtimeIc >= mon.realtimeIcThreshold ? s.positive : s.negative}`}
          >
            {mon.realtimeIc.toFixed(3)}
          </div>
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            Threshold: {mon.realtimeIcThreshold.toFixed(3)}
          </div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Coverage</div>
          <div
            className={`${s.kpiValue} ${mon.coverage >= mon.coverageThreshold ? s.positive : s.negative}`}
          >
            {(mon.coverage * 100).toFixed(0)}%
          </div>
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            Threshold: {(mon.coverageThreshold * 100).toFixed(0)}%
          </div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Direction Reversals</div>
          <div
            className={`${s.kpiValue} ${mon.directionReversalCount <= mon.directionReversalThreshold ? s.positive : s.negative}`}
          >
            {mon.directionReversalCount}
          </div>
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            Threshold: {mon.directionReversalThreshold}
          </div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Extreme Value Ratio</div>
          <div
            className={`${s.kpiValue} ${mon.extremeValueRatio <= mon.extremeValueThreshold ? s.positive : s.negative}`}
          >
            {(mon.extremeValueRatio * 100).toFixed(1)}%
          </div>
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            Threshold: {(mon.extremeValueThreshold * 100).toFixed(0)}%
          </div>
        </div>
        <div className={s.kpiCard}>
          <div className={s.kpiLabel}>Data Delay</div>
          <div className={s.kpiValue}>{mon.dataDelay}</div>
          <div style={{ marginTop: 4, fontSize: 'var(--text-xs)', color: 'var(--muted)' }}>
            Threshold: {mon.dataDelayThreshold}
          </div>
        </div>
      </div>

      <FactorReportSection title={u.alerts} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Threshold</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {mon.alerts.map((alert, i) => (
              <tr key={i}>
                <td>{alert.metric}</td>
                <td>{alert.value}</td>
                <td style={{ color: 'var(--muted)' }}>{alert.threshold}</td>
                <td className={statusClass(alert.status)}>{statusLabel(alert.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>
    </>
  );
}
