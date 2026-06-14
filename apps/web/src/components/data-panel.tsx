import type { ResearchJob, StrategyRow, UiCopy } from '../appData';
import { JobList } from './jobs';
import { StrategyTable } from './strategy-table';

export function DataPanel({
  activePage,
  jobs,
  onSelectStrategy,
  onViewReport,
  reportJobIds,
  selectedStrategyId,
  strategies,
  ui,
}: {
  activePage: string;
  jobs: ResearchJob[];
  onSelectStrategy: (strategy: StrategyRow) => void;
  onViewReport: (job: ResearchJob) => void;
  reportJobIds: string[];
  selectedStrategyId?: string;
  strategies: StrategyRow[];
  ui: UiCopy;
}) {
  if (activePage === 'jobs') {
    return <JobList jobs={jobs} onViewReport={onViewReport} reportJobIds={reportJobIds} ui={ui} />;
  }

  return (
    <StrategyTable
      onSelectStrategy={onSelectStrategy}
      selectedStrategyId={selectedStrategyId}
      strategies={strategies}
      ui={ui}
    />
  );
}
