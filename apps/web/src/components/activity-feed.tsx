import type { ResearchJob, UiCopy } from '../appData';
import s from '../styles/activity-feed.module.css';

function jobToIcon(state: string) {
  switch (state) {
    case 'Running':
      return s.dotRunning;
    case 'Completed':
      return s.dotCompleted;
    case 'Failed':
      return s.dotFailed;
    case 'Queued':
      return s.dotQueued;
    default:
      return '';
  }
}

function jobToBadge(state: string) {
  switch (state) {
    case 'Running':
      return s.badgeGreen;
    case 'Completed':
      return s.badgeGreen;
    case 'Failed':
      return s.badgeRed;
    case 'Queued':
      return s.badgeAmber;
    default:
      return '';
  }
}

export function ActivityFeed({
  jobs,
  ui,
}: {
  jobs: ResearchJob[];
  ui: UiCopy;
}) {
  const items = jobs.slice(0, 6);

  return (
    <section className={s.feed}>
      <h3>{ui.activityFeedTitle}</h3>
      {items.length === 0 ? (
        <p className={s.empty}>{ui.activityFeedEmpty}</p>
      ) : (
        <div className={s.timeline}>
          {items.map((job) => (
            <div className={s.item} key={job.id}>
              <span className={`${s.dot} ${jobToIcon(job.state)}`} />
              <div className={s.body}>
                <strong>{job.name}</strong>
                <div className={s.meta}>
                  <span>{job.strategyName}</span>
                  <span className={`${s.badge} ${jobToBadge(job.state)}`}>
                    {job.state}
                  </span>
                  <span>{job.progress}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}