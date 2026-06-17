import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import styles from '@/styles/report-tables.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

export function ReportDataParams({ report, ui }: Props) {
  const dp = report.dataParams;
  const labels = ui.dataParams;

  return (
    <div className={styles.dataParams}>
      {/* ── 基础信息 ── */}
      <div className={styles.paramGroup}>
        <h4 className={styles.sectionTitle}>{labels.dataSource}</h4>
        <dl className={styles.defList}>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.dataSource}</dt>
            <dd className={styles.defVal}>{dp.dataSource}</dd>
          </div>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.adjustment}</dt>
            <dd className={styles.defVal}>{dp.adjustmentType}</dd>
          </div>
        </dl>
      </div>

      {/* ── 费用 ── */}
      <div className={styles.paramGroup}>
        <h4 className={styles.sectionTitle}>{labels.fee}</h4>
        <dl className={styles.defList}>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.commission}</dt>
            <dd className={styles.defVal}>{dp.fee.commission}</dd>
          </div>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.stampTax}</dt>
            <dd className={styles.defVal}>{dp.fee.stampTax}</dd>
          </div>
        </dl>
      </div>

      {/* ── 滑点 ── */}
      <div className={styles.paramGroup}>
        <h4 className={styles.sectionTitle}>{labels.slippage}</h4>
        <dl className={styles.defList}>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.slippage}</dt>
            <dd className={styles.defVal}>{dp.slippage.model}</dd>
          </div>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>值</dt>
            <dd className={styles.defVal}>{dp.slippage.value}%</dd>
          </div>
        </dl>
      </div>

      {/* ── 资金 ── */}
      <div className={styles.paramGroup}>
        <h4 className={styles.sectionTitle}>{labels.capital}</h4>
        <dl className={styles.defList}>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.initialCash}</dt>
            <dd className={styles.defVal}>{dp.capital.initialCash.toLocaleString()}</dd>
          </div>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.maxLeverage}</dt>
            <dd className={styles.defVal}>{dp.capital.maxLeverage}x</dd>
          </div>
          <div className={styles.defRow}>
            <dt className={styles.defKey}>{labels.positionLimit}</dt>
            <dd className={styles.defVal}>{(dp.capital.positionLimit * 100).toFixed(0)}%</dd>
          </div>
        </dl>
      </div>

      {/* ── 策略参数 ── */}
      <div className={`${styles.paramGroup} ${styles.paramGroupFull}`}>
        <h4 className={styles.sectionTitle}>{labels.params}</h4>
        <dl className={styles.defList}>
          {dp.params.map((p) => (
            <div key={p.label} className={styles.defRow}>
              <dt className={styles.defKey}>{p.label}</dt>
              <dd className={styles.defVal}>{p.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
