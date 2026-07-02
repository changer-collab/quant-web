import type { FactorReportFull, FactorReportUiCopy } from '../../appData';
import { FactorReportSection } from './FactorReportSection';
import s from '../../styles/factor-report.module.css';

interface Props {
  report: FactorReportFull;
  ui: FactorReportUiCopy;
}

function heatColor(value: number): string {
  const abs = Math.min(Math.abs(value), 1);
  if (value >= 0) return `rgba(77, 240, 160, ${abs * 0.6 + 0.05})`;
  return `rgba(255, 107, 107, ${abs * 0.6 + 0.05})`;
}

const CLUSTER_COLORS: Record<string, string> = {
  'Cluster 1': '#4df0a0',
  'Cluster 2': '#62d8ff',
  'Cluster 3': '#e9c46a',
  'Cluster 4': '#a78bfa',
  'Cluster 5': '#ff6b6b',
  'Cluster 6': '#60a5fa',
};

function getClusterColor(cluster: string): string {
  return CLUSTER_COLORS[cluster] ?? '#8fa29b';
}

export function FactorCorrelation({ report, ui }: Props) {
  const corr = report.correlation;
  const u = ui.correlation;

  const factors = [...new Set(corr.correlationMatrix.map((r) => r.factorA))];
  const matrixMap = new Map<string, number>();
  corr.correlationMatrix.forEach((r) => {
    matrixMap.set(`${r.factorA}-${r.factorB}`, r.corr);
    matrixMap.set(`${r.factorB}-${r.factorA}`, r.corr);
  });

  return (
    <>
      <FactorReportSection title={u.correlationMatrix} defaultOpen={true}>
        <div
          className={s.heatmapGrid}
          style={{ gridTemplateColumns: `100px repeat(${factors.length}, 1fr)` }}
        >
          <div className={s.heatmapCell} style={{ background: 'transparent' }} />
          {factors.map((f) => (
            <div
              key={f}
              className={s.heatmapCell}
              style={{ background: 'transparent', color: 'var(--muted)', fontSize: '10px' }}
            >
              {f}
            </div>
          ))}
          {factors.map((rowFactor) => (
            <>
              <div
                key={`label-${rowFactor}`}
                className={s.heatmapCell}
                style={{ background: 'transparent', color: 'var(--muted)', fontSize: '10px' }}
              >
                {rowFactor}
              </div>
              {factors.map((colFactor) => {
                const v =
                  matrixMap.get(`${rowFactor}-${colFactor}`) ?? (rowFactor === colFactor ? 1 : 0);
                return (
                  <div
                    key={`${rowFactor}-${colFactor}`}
                    className={s.heatmapCell}
                    style={{ background: heatColor(v), color: 'var(--text)' }}
                  >
                    {v.toFixed(2)}
                  </div>
                );
              })}
            </>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.returnCorrelation} defaultOpen={true}>
        <div className={s.barChartHorizontal}>
          {corr.returnCorrelation.map((r, i) => {
            const maxCorr = Math.max(...corr.returnCorrelation.map((x) => Math.abs(x.corr)), 0.001);
            return (
              <div key={i} className={s.barRow}>
                <span className={s.barLabel}>
                  {r.factorA} ↔ {r.factorB}
                </span>
                <div className={s.barTrack}>
                  <div
                    className={`${s.barFill} ${r.corr < 0 ? s.negative : ''}`}
                    style={{ width: `${(Math.abs(r.corr) / maxCorr) * 100}%` }}
                  />
                </div>
                <span className={s.barValue}>{r.corr.toFixed(2)}</span>
              </div>
            );
          })}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.clustering} defaultOpen={true}>
        <div className={s.clusterGrid}>
          {corr.clusters.map((cluster) => (
            <div key={cluster.cluster} className={s.clusterCard}>
              <div className={s.clusterCardTitle}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: getClusterColor(cluster.cluster),
                    marginRight: 8,
                    verticalAlign: 'middle',
                  }}
                />
                {cluster.cluster}
              </div>
              <div className={s.clusterFactorList}>
                {cluster.factors.map((f) => (
                  <div key={f} className={s.clusterFactorItem}>
                    <span
                      className={s.clusterFactorDot}
                      style={{ background: getClusterColor(cluster.cluster) }}
                    />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </FactorReportSection>

      <FactorReportSection title={u.pca} defaultOpen={true}>
        <div className={s.gridTable3}>
          <div className={s.gridTableHeader}>
            <span className={s.colLabel}>Component</span>
            <span className={s.colValue}>Variance Explained</span>
            <span className={s.colValue}>Cumulative</span>
          </div>
          {corr.pcaVariance.map((p, i) => (
            <div key={i} className={s.gridTableRow}>
              <span className={s.colLabel}>{p.component}</span>
              <span className={s.colValue}>{(p.variance * 100).toFixed(1)}%</span>
              <span className={s.colValue}>{(p.cumulative * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </FactorReportSection>
    </>
  );
}
