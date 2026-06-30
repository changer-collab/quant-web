import type { LanguageCode, ResearchJob } from './types';
import { getContent, getStrategies } from './accessors';

/** 将英文状态映射为当前语言的本地化状态文本 */
export function localizeJobState(state: string, language?: LanguageCode): string {
  const content = getContent(language);
  const map: Record<string, string> = {
    Running: content.runningState,
    Completed: content.completedState,
    Failed: content.failedState,
    Queued: content.queuedState,
  };
  return map[state] ?? state;
}

export function localizeResearchJob(job: ResearchJob, language?: LanguageCode): ResearchJob {
  const content = getContent(language);
  const seedJob = content.jobs.find((item) => item.id === job.id);

  if (job.template !== 'run' && seedJob) {
    return { ...seedJob, progress: job.progress };
  }

  if (job.template !== 'run') {
    return { ...job, state: localizeJobState(job.state, language) };
  }

  const mode = job.mode ?? 'non_factor';
  const strategy = job.strategyId ? getStrategies(language).find((item) => item.id === job.strategyId) : undefined;
  const strategyName = strategy?.name ?? `${mode}${content.draftSuffix} #${job.sequence ?? 1}`;

  return {
    ...job,
    kind: mode,
    name: `${content.runJobPrefix}${strategyName}`,
    state: localizeJobState(job.state, language),
    strategyName: strategy?.name ?? mode,
  };
}