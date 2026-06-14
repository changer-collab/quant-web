import type { ResearchReport, UiCopy } from '../appData';
import { MetricCard } from './common';
import report from '../styles/report.module.css';
import hero from '../styles/hero.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';

export function ReportSummary({ report: reportData, ui }: { report: ResearchReport; ui: UiCopy }) {
  return (
    <section className={report.reportSummary}>
      <div className={report.reportHeader}>
        <div>
          <p className={report.reportEyebrow}>{ui.reportSummaryTitle}</p>
          <h3 className={report.reportTitle}>{reportData.title}</h3>
        </div>
        <mark className={report.reportStatus}>{reportData.status}</mark>
      </div>
      <dl className={report.reportMeta}>
        <div className={report.reportMetaItem}>
          <dt className={report.reportMetaLabel}>{ui.reportStrategy}</dt>
          <dd className={report.reportMetaValue}>{reportData.strategyName}</dd>
        </div>
        <div className={report.reportMetaItem}>
          <dt className={report.reportMetaLabel}>{ui.reportMode}</dt>
          <dd className={report.reportMetaValue}>{reportData.modeName}</dd>
        </div>
        <div className={report.reportMetaItem}>
          <dt className={report.reportMetaLabel}>{ui.reportJob}</dt>
          <dd className={report.reportMetaValue}>{reportData.jobId}</dd>
        </div>
        <div className={report.reportMetaItem}>
          <dt className={report.reportMetaLabel}>{ui.reportGeneratedAt}</dt>
          <dd className={report.reportMetaValue}>{reportData.generatedAt}</dd>
        </div>
      </dl>
      <div className={`${hero.metricGrid} ${hero.metricGridCompact}`}>
        {reportData.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <div className={report.reportDiagnostics}>
        {reportData.diagnostics.map((section) => (
          <article className={report.diagnosticSection} key={section.title}>
            <h4>{section.title}</h4>
            <div className={infoPanelStyles.chipRow}>
              {section.items.map((item) => (
                <span className={infoPanelStyles.chip} key={item}>
                  {item}
                </span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
