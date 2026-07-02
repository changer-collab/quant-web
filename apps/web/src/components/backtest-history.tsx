import type { ResearchJob, UiCopy } from '../appData';
import s from '../styles/backtest-history.module.css';

export function BacktestHistory({
  jobs,
  onViewReport,
  reportJobIds = [],
  ui,
}: {
  jobs: ResearchJob[];
  onViewReport?: (job: ResearchJob) => void;
  reportJobIds?: string[];
  ui: UiCopy;
}) {
  const backtestJobs = jobs.filter((j) => j.template === 'backtest');

  if (backtestJobs.length === 0) {
    return (
      <section className={s.panel}>
        <h3>{ui.backtestHistoryTitle}</h3>
        <p className={s.empty}>{ui.backtestHistoryEmpty}</p>
      </section>
    );
  }

  return (
    <section className={s.panel}>
      <h3>{ui.backtestHistoryTitle}</h3>
      <div className={s.list}>
        {backtestJobs.map((job) => {
          const isComplete = job.state === 'completed' || job.state === 'Completed';

          return (
            <div className={s.item} key={job.id}>
              <div className={s.itemInfo}>
                <div className={s.itemName}>{job.name}</div>
                <div className={s.itemMeta}>
                  <span className={s.modeTag}>{job.kind}</span>
                  <span>{job.state}</span>
                  {isComplete && <span>100%</span>}
                </div>
                {job.errorMessage && <div className={s.errorDetail}>{job.errorMessage}</div>}
              </div>
              <div className={s.itemMetrics}>
                {job.strategyName && (
                  <div className={s.miniMetric}>
                    <span className={`${s.miniValue}`}>{job.strategyName}</span>
                    <span className={s.miniLabel}>Strategy</span>
                  </div>
                )}
                {!isComplete && (
                  <div className={s.progress}>
                    <i
                      className={`${s.progressBar} ${job.state === 'running' || job.state === 'Running' ? s.progressDone : ''}`}
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                )}
              </div>
              {ui && onViewReport && reportJobIds.includes(job.id) && (
                <button className={s.viewBtn} onClick={() => onViewReport(job)} type="button">
                  {ui.viewReport}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
