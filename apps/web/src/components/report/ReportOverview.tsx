import type { BacktestReportFull, ReportUiCopy } from '../../appData';
import overview from '@/styles/report-overview.module.css';
import section from '@/styles/report-section.module.css';

interface Props {
  report: BacktestReportFull;
  ui: ReportUiCopy;
}

export function ReportOverview({ report, ui }: Props) {
  const o = report.overview;
  const labels = ui.overview;

  return (
    <section className={overview.panel}>
      <header className={overview.header}>
        <div>
          <h3 className={overview.name}>{o.name}</h3>
          <span className={overview.version}>v{o.version}</span>
        </div>
        <span className={`${overview.status} ${overview[report.status] ?? ''}`}>
          {report.status}
        </span>
      </header>

      <div className={overview.logicCard}>
        <span className={overview.logicLabel}>{labels.logic}</span>
        <p className={overview.logicText}>{o.logic}</p>
      </div>

      <div className={overview.metaGrid}>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.instruments}</span>
          <div className={overview.chipRow}>
            {o.instruments.map((inst) => (
              <span key={inst} className={overview.chip}>{inst}</span>
            ))}
          </div>
        </div>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.timeRange}</span>
          <span className={overview.metaValue}>{o.timeRange.start} ~ {o.timeRange.end}</span>
        </div>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.frequency}</span>
          <span className={overview.metaValue}>{o.frequency}</span>
        </div>
        <div className={overview.metaItem}>
          <span className={overview.metaLabel}>{labels.benchmark}</span>
          <span className={overview.metaValue}>{o.benchmark}</span>
        </div>
      </div>
    </section>
  );
}