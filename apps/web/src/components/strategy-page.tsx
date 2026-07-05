import type { StrategyRow, UiCopy, LanguageCode } from '../appData';
import { StrategyGridNew } from './strategy-grid-new';
import s from '../styles/strategy-page.module.css';

interface StrategyPageProps {
  strategies: StrategyRow[];
  onEnterWorkspace: (strategy: StrategyRow) => void;
  ui: UiCopy;
  language: LanguageCode;
}

export function StrategyPage({ strategies, onEnterWorkspace, ui, language }: StrategyPageProps) {
  return (
    <div>
      <StrategyGridNew
        strategies={strategies}
        onEnterWorkspace={onEnterWorkspace}
        ui={ui}
        language={language}
      />
    </div>
  );
}
