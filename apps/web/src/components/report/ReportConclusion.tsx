import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-conclusion.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

export function ReportConclusion({ report, ui }: Props) {
  const c = report.conclusion;
  const labels = ui.conclusion;

  return (
    <section className={styles.panel}>
      {/* 策略优势 */}
      <div className={styles.block}>
        <h4 className={`${styles.blockTitle} ${styles.titleAdv}`}>{labels.advantages}</h4>
        <ul className={styles.list}>
          {c.advantages.map((item, i) => (
            <li key={i} className={styles.listItem}>
              <span className={`${styles.marker} ${styles.markerAdv}`} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 潜在风险 */}
      <div className={styles.block}>
        <h4 className={`${styles.blockTitle} ${styles.titleRisk}`}>{labels.potentialRisks}</h4>
        <ul className={styles.list}>
          {c.potentialRisks.map((item, i) => (
            <li key={i} className={styles.listItem}>
              <span className={`${styles.marker} ${styles.markerRisk}`} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 改进方向 */}
      <div className={styles.block}>
        <h4 className={`${styles.blockTitle} ${styles.titleImprove}`}>{labels.improvements}</h4>
        <ul className={styles.list}>
          {c.improvements.map((item, i) => (
            <li key={i} className={styles.listItem}>
              <span className={`${styles.marker} ${styles.markerImprove}`} aria-hidden="true" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 实盘建议 */}
      <div className={styles.adviceBlock}>
        <h4 className={styles.blockTitle}>{labels.liveTradingAdvice}</h4>
        <div className={styles.adviceGrid}>
          <div className={styles.adviceItem}>
            <span className={styles.adviceLabel}>{labels.suggestedCapital}</span>
            <span className={styles.adviceValue}>{c.liveTradingAdvice.suggestedCapital}</span>
          </div>
          <div className={styles.adviceItem}>
            <span className={styles.adviceLabel}>{labels.suggestedInitialPosition}</span>
            <span className={styles.adviceValue}>{c.liveTradingAdvice.suggestedInitialPosition}</span>
          </div>
        </div>
        <div className={styles.rulesBlock}>
          <span className={styles.adviceLabel}>{labels.riskControlRules}</span>
          <div className={styles.rulesList}>
            {c.liveTradingAdvice.riskControlRules.map((rule, i) => (
              <span key={i} className={styles.ruleChip}>{rule}</span>
            ))}
          </div>
        </div>
      </div>

      {/* 适用市场环境 */}
      <div className={styles.block}>
        <h4 className={styles.blockTitle}>{labels.suitableMarketRegime}</h4>
        <div className={styles.regimeList}>
          {c.suitableMarketRegime.map((regime, i) => (
            <span key={i} className={styles.regimeChip}>{regime}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
