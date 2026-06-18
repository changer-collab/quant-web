import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-executive.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function ReportExecutiveSummary({ report, ui }: Props) {
  const s = report.executiveSummary;
  const labels = ui.executiveSummary;

  return (
    <section className={styles.panel}>
      {/* 核心结论 */}
      <div className={styles.header}>
        <p className={styles.conclusion}>{s.oneLineConclusion}</p>
        <span
          className={`${styles.recommendBadge} ${
            s.recommendedForLive ? styles.recommendYes : styles.recommendNo
          }`}
        >
          {labels.recommendedForLive}: {s.recommendedForLive ? labels.yes : labels.no}
        </span>
      </div>

      {/* 核心三指标 */}
      <div>
        <h4 className={styles.sectionTitle}>{labels.keyMetrics}</h4>
        <div className={styles.keyMetricsGrid}>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>{labels.annualizedReturn}</span>
            <strong className={styles.metricValue}>{pct(s.keyMetrics.annualizedReturn)}</strong>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>{labels.maxDrawdown}</span>
            <strong className={styles.metricValue}>{pct(s.keyMetrics.maxDrawdown)}</strong>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>{labels.sharpeRatio}</span>
            <strong className={styles.metricValue}>{s.keyMetrics.sharpeRatio.toFixed(2)}</strong>
          </article>
        </div>
      </div>

      {/* 推荐理由 */}
      <div className={styles.reasonBlock}>
        <span className={styles.sectionTitle}>{labels.recommendationReason}</span>
        <p className={styles.reasonText}>{s.recommendationReason}</p>
      </div>

      {/* 主要风险 */}
      <div>
        <h4 className={styles.sectionTitle}>{labels.mainRisks}</h4>
        <div className={styles.risksList}>
          {s.mainRisks.map((risk, i) => (
            <div key={i} className={styles.riskItem}>
              <span className={styles.riskDot} aria-hidden="true" />
              <span>{risk}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
