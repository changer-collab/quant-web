import type { ResearchJob, UiCopy } from '../appData';
import s from '../styles/backtest-history.module.css';

const MODE_RETURN: Record<string, string> = {
  'traditional': '+21.4%',
  'hft': '+34.6%',
  'ai': '+27.1%',
};

const MODE_SHARPE: Record<string, string> = {
  'traditional': '1.72',
  'hft': '2.18',
  'ai': '1.94',
};

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
  const backtestJobs = jobs.filter(
    (j) => j.template === 'backtest',
  );

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
          const isComplete = job.state === 'Completed' || job.state === '已完成';
          const mode = job.mode ?? 'traditional';
          const simReturn = MODE_RETURN[mode] ?? '';
          const simSharpe = MODE_SHARPE[mode] ?? '';

          return (
            <div className={s.item} key={job.id}>
              <div className={s.itemInfo}>
                <div className={s.itemName}>{job.name}</div>
                <div className={s.itemMeta}>
                  <span className={s.modeTag}>{job.kind}</span>
                  <span>{job.state}</span>
                  {isComplete && <span>{job.progress}%</span>}
                </div>
              </div>
              <div className={s.itemMetrics}>
                <div className={s.miniMetric}>
                  <span className={`${s.miniValue} ${s.miniGood}`}>{simReturn}</span>
                  <span className={s.miniLabel}>Ret</span>
                </div>
                <div className={s.miniMetric}>
                  <span className={`${s.miniValue} ${s.miniWarn}`}>{simSharpe}</span>
                  <span className={s.miniLabel}>Spr</span>
                </div>
                {!isComplete && (
                  <div className={s.progress}>
                    <i
                      className={`${s.progressBar} ${job.state === 'Running' || job.state === '运行中' ? s.progressDone : ''}`}
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