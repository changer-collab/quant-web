import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

export function FactorRobustness({ report, ui }: Props) {
  const rob = report.robustness;
  const u = ui.robustness;

  return (
    <>
      <FactorReportSection title={u.parameterSensitivity} defaultOpen={true}>
        {rob.paramSensitivity.map((param) => (
          <div key={param.paramName} style={{ marginBottom: 'var(--space-md)' }}>
            <h4 style={{ color: 'var(--text)', fontSize: 'var(--text-sm)', marginBottom: 8 }}>{param.paramName}</h4>
            <table className={s.dataTable}>
              <thead>
                <tr><th>Value</th><th>IC</th><th>Group Return</th></tr>
              </thead>
              <tbody>
                {param.variations.map((v, i) => (
                  <tr key={i}>
                    <td>{v.value}</td>
                    <td className={v.ic > 0 ? s.alertNormal : s.alertCritical}>{v.ic.toFixed(3)}</td>
                    <td className={v.groupReturn >= 0 ? s.alertNormal : s.alertCritical}>
                      {(v.groupReturn * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </FactorReportSection>

      <FactorReportSection title={u.inSampleVsOutOfSample} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr><th>Metric</th><th>In-Sample</th><th>Out-of-Sample</th></tr>
          </thead>
          <tbody>
            {rob.inSampleVsOutOfSample.map((row, i) => (
              <tr key={i}>
                <td>{row.metric}</td>
                <td>{row.inSample.toFixed(3)}</td>
                <td className={row.outOfSample >= row.inSample * 0.7 ? s.alertNormal : s.alertWarning}>
                  {row.outOfSample.toFixed(3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title={u.benchmarkComparison} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr><th>Benchmark</th><th>IC</th><th>Group Return</th></tr>
          </thead>
          <tbody>
            {rob.benchmarkComparison.map((b, i) => (
              <tr key={i}>
                <td>{b.benchmark}</td>
                <td className={b.ic > 0 ? s.alertNormal : s.alertCritical}>{b.ic.toFixed(3)}</td>
                <td className={b.groupReturn >= 0 ? s.alertNormal : s.alertCritical}>
                  {(b.groupReturn * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title={u.weightingComparison} defaultOpen={true}>
        <table className={s.dataTable}>
          <thead>
            <tr><th>Method</th><th>IC</th><th>Group Return</th></tr>
          </thead>
          <tbody>
            {rob.weightingComparison.map((w, i) => (
              <tr key={i}>
                <td>{w.method}</td>
                <td className={w.ic > 0 ? s.alertNormal : s.alertCritical}>{w.ic.toFixed(3)}</td>
                <td className={w.groupReturn >= 0 ? s.alertNormal : s.alertCritical}>
                  {(w.groupReturn * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </FactorReportSection>

      <FactorReportSection title={u.survivorshipBias} defaultOpen={true}>
        <div className={s.kpiGrid}>
          <div className={s.kpiCard}>
            <div className={s.kpiLabel}>Survivorship Bias Handled</div>
            <div className={`${s.kpiValue} ${rob.survivorshipBiasHandled ? s.positive : s.negative}`}>
              {rob.survivorshipBiasHandled ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </FactorReportSection>
    </>
  );
}
