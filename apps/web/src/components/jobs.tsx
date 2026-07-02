import { FileText, AlertCircle } from 'lucide-react';
import type { ResearchJob, UiCopy } from '../appData';
import jobs from '../styles/jobs.module.css';
import infoPanelStyles from '../styles/info-panel.module.css';
import buttons from '../styles/buttons.module.css';

export function JobList({
  jobs: jobList,
  onViewReport,
  reportJobIds = [],
  ui,
}: {
  jobs: ResearchJob[];
  onViewReport?: (job: ResearchJob) => void;
  reportJobIds?: string[];
  ui?: UiCopy;
}) {
  const reportJobIdSet = new Set(reportJobIds);

  return (
    <section className={jobs.jobList}>
      {jobList.map((job) => (
        <article className={jobs.jobCard} key={job.id}>
          <div>
            <span>{job.kind}</span>
            <strong>{job.name}</strong>
            <small>{job.state}</small>
            {job.errorMessage && (
              <div className={jobs.errorDetail}>
                <AlertCircle aria-hidden="true" size={12} />
                <span>{job.errorMessage}</span>
              </div>
            )}
          </div>
          {job.configSummary?.length ? (
            <div className={jobs.jobConfigSummary}>
              {job.configSummary.map((item) => (
                <span className={infoPanelStyles.chip} key={item}>
                  {item}
                </span>
              ))}
            </div>
          ) : null}
          <div className={jobs.progress} aria-label={`${job.progress}%`}>
            <i
              className={jobs.progressBar}
              style={{ width: `${job.progress}%`, transition: 'width 0.3s ease' }}
            />
          </div>
          {ui && onViewReport && reportJobIdSet.has(job.id) && (
            <button
              className={buttons.secondaryAction}
              onClick={() => onViewReport(job)}
              type="button"
            >
              <FileText aria-hidden="true" size={16} />
              {ui.viewReport}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
