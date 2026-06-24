import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-metrics.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function rating(v: number, labels: ReportUiCopy['riskAdj']): { ratingLabel: string; tone: string } {
  if (v >= 2) return { ratingLabel: labels.ratingExcellent, tone: 'good' };
  if (v >= 1) return { ratingLabel: labels.ratingGood, tone: 'good' };
  if (v >= 0) return { ratingLabel: labels.ratingAverage, tone: 'info' };
  return { ratingLabel: labels.ratingPoor, tone: 'warn' };
}

export function ReportRiskAdjMetrics({ report, ui }: Props) {
  const m = report.riskAdjMetrics;
  const labels = ui.riskAdj;

  const cards = [
    { label: labels.sharpe, value: m.sharpeRatio.toFixed(2), ...rating(m.sharpeRatio, labels) },
    { label: labels.sortino, value: m.sortinoRatio.toFixed(2), ...rating(m.sortinoRatio, labels) },
    { label: labels.infoRatio, value: m.informationRatio.toFixed(2), ...rating(m.informationRatio, labels) },
    { label: labels.treynor, value: m.treynorRatio.toFixed(2), ratingLabel: '', tone: 'info' },
  ];

  return (
    <div className={styles.metricGrid}>
      {cards.map((card) => (
        <article key={card.label} className={`${styles.metricCard} ${styles[`tone${card.tone}`]}`}>
          <span className={styles.metricLabel}>{card.label}</span>
          <strong className={styles.metricValue}>{card.value}</strong>
          {card.ratingLabel && <span className={styles.metricBadge}>{card.ratingLabel}</span>}
        </article>
      ))}
    </div>
  );
}