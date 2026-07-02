import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-warnings.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

export function ReportRiskWarnings({ report, ui }: Props) {
  const w = report.riskWarnings;
  const labels = ui.riskWarnings;

  return (
    <section className={styles.panel}>
      {/* 不足与风险提示 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.limitations}</h4>
        <div className={styles.limitationsList}>
          {w.limitations.map((lim, i) => (
            <div key={i} className={styles.limitationItem}>
              <span className={styles.limitationCategory}>{lim.category}</span>
              <span className={styles.limitationDesc}>{lim.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 关键红线检查 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.redLines}</h4>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{labels.rule}</th>
                <th>{labels.threshold}</th>
                <th>{labels.actual}</th>
                <th>{labels.passed}</th>
              </tr>
            </thead>
            <tbody>
              {w.redLines.map((rl, i) => (
                <tr key={i}>
                  <td className={styles.ruleCell}>{rl.rule}</td>
                  <td className={styles.thresholdCell}>{rl.threshold}</td>
                  <td className={styles.actualCell}>{rl.actual}</td>
                  <td className={styles.statusCell}>
                    <span
                      className={`${styles.statusBadge} ${rl.passed ? styles.statusPass : styles.statusFail}`}
                    >
                      {rl.passed ? labels.passed : labels.failed}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 关键代码 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.codeSnippets}</h4>
        {w.codeSnippets.map((snippet, i) => (
          <div key={i} className={styles.codeBlock}>
            <div className={styles.codeHeader}>
              <span className={styles.codeTitle}>{snippet.title}</span>
              <span className={styles.codeLang}>{snippet.language}</span>
            </div>
            <pre className={styles.codePre}>
              <code>{snippet.code}</code>
            </pre>
          </div>
        ))}
      </div>

      {/* 术语表 */}
      <div className={styles.block}>
        <h4 className={styles.sectionTitle}>{labels.glossary}</h4>
        <div className={styles.glossaryList}>
          {w.glossary.map((g, i) => (
            <div key={i} className={styles.glossaryItem}>
              <dt className={styles.glossaryTerm}>{g.term}</dt>
              <dd className={styles.glossaryDef}>{g.definition}</dd>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
