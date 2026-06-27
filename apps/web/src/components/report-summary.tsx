import type { ResearchReport, UiCopy } from '../appData';
import { MetricCard } from './common';
import reportStyles from '../styles/report.module.css';
import hero from '../styles/hero.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';

export function ReportSummary({ report: reportData, ui }: { report: ResearchReport; ui: UiCopy }) {
  return (
    <section className={reportStyles.reportSummary}>
      <div className={reportStyles.reportHeader}>
        <div>
          <p className={reportStyles.reportEyebrow}>{ui.reportSummaryTitle}</p>
          <h3 className={reportStyles.reportTitle}>{reportData.title}</h3>
        </div>
        <mark className={reportStyles.reportStatus}>{reportData.status}</mark>
      </div>
      <dl className={reportStyles.reportMeta}>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportStrategy}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.strategyName}</dd>
        </div>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportMode}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.modeName}</dd>
        </div>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportJob}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.jobId}</dd>
        </div>
        <div className={reportStyles.reportMetaItem}>
          <dt className={reportStyles.reportMetaLabel}>{ui.reportGeneratedAt}</dt>
          <dd className={reportStyles.reportMetaValue}>{reportData.generatedAt}</dd>
        </div>
      </dl>
      <div className={`${hero.metricGrid} ${hero.metricGridCompact}`}>
        {reportData.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>
      <div className={reportStyles.reportDiagnostics}>
        {reportData.diagnostics.map((section) => (
          <article className={reportStyles.diagnosticSection} key={section.title}>
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
