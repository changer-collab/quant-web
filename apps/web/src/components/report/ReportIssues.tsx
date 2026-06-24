import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-tables.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

function RiskIndicator({ level, ui }: { level: 'low' | 'medium' | 'high'; ui: ReportUiCopy['issues'] }) {
  const cls = level === 'low' ? styles.riskLow : level === 'medium' ? styles.riskMed : styles.riskHigh;
  const label = level === 'low' ? ui.lowSeverity : level === 'medium' ? ui.mediumSeverity : ui.highSeverity;
  return (
    <span className={`${styles.riskDot} ${cls}`} title={label}>
      <span className={styles.riskLabel}>{label}</span>
    </span>
  );
}

export function ReportIssues({ report, ui }: Props) {
  const issues = report.issues;
  const labels = ui.issues;

  return (
    <div className={styles.issuesPanel}>
      <div className={`${styles.issuesGrid} ${styles.issuesGridFull}`}>
        <article className={styles.issueCard}>
          <div className={styles.issueHeader}>
            <span className={styles.issueLabel}>{labels.overfitting}</span>
            <RiskIndicator level={issues.overfittingRisk} ui={labels} />
          </div>
        </article>
        <article className={styles.issueCard}>
          <div className={styles.issueHeader}>
            <span className={styles.issueLabel}>{labels.survivorshipBias}</span>
            <span className={issues.survivorshipBias ? styles.issueBadWarn : styles.issueBadGood}>
              {issues.survivorshipBias ? labels.yesLabel : labels.noLabel}
            </span>
          </div>
        </article>
        <article className={styles.issueCard}>
          <div className={styles.issueHeader}>
            <span className={styles.issueLabel}>{labels.lookAheadBias}</span>
            <span className={issues.lookAheadBias ? styles.issueBadWarn : styles.issueBadGood}>
              {issues.lookAheadBias ? labels.yesLabel : labels.noLabel}
            </span>
          </div>
        </article>
      </div>

      <div className={styles.assessCard}>
        <h4 className={styles.assessTitle}>{labels.liquidity}</h4>
        <p className={styles.assessText}>{issues.liquidityAssessment}</p>
      </div>

      <div className={styles.assessCard}>
        <h4 className={styles.assessTitle}>{labels.capacity}</h4>
        <p className={styles.assessText}>{issues.capacityEstimate}</p>
      </div>
    </div>
  );
}