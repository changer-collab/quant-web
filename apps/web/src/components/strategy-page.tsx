import { useState } from 'react';
import type { StrategyRow, UiCopy, LanguageCode } from '../appData';
import { StrategyGridNew } from './strategy-grid-new';
import s from '../styles/strategy-page.module.css';

type ViewMode = 'grid' | 'config';

interface StrategyPageProps {
  strategies: StrategyRow[];
  onEnterWorkspace: (strategy: StrategyRow) => void;
  ui: UiCopy;
  language: LanguageCode;
}

export function StrategyPage({
  strategies,
  onEnterWorkspace,
  ui,
  language,
}: StrategyPageProps) {
  const [view, setView] = useState<ViewMode>('grid');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | null>(null);

  function handleSelectStrategy(strategy: StrategyRow) {
    setSelectedStrategy(strategy);
    setView('config');
  }

  function handleBackToGrid() {
    setView('grid');
    setSelectedStrategy(null);
  }

  if (view === 'config' && selectedStrategy) {
    return (
      <div>
        <div className={s.overviewHeader}>
          <button className={s.backButton} onClick={handleBackToGrid} type="button">
            {ui.backToOverview}
          </button>
        </div>

        <div className={s.strategySelector}>
          <span className={s.strategySelectorName}>{selectedStrategy.name}</span>
          <div className={s.strategySelectorMeta}>
            <span>
              {(ui.strategyCategoryLabels as Record<string, string>)[selectedStrategy.category ?? 'non_factor']}
            </span>
            <span>·</span>
            <span>
              {(ui.strategySubcategoryLabels as Record<string, string>)[selectedStrategy.subcategory ?? '']}
            </span>
          </div>
        </div>

        <div className={s.configLayout}>
          <div className={s.configPanel}>
            <div className={s.panelHeader}>
              {language === 'zh' ? '配置面板' : 'Config Panel'}
            </div>
            <div className={s.placeholderContent}>
              <p>{ui.configPanelPlaceholder}</p>
            </div>
          </div>
          <div className={s.klinePanel}>
            <div className={s.panelHeader}>
              {language === 'zh' ? 'K 线图' : 'K-Line Chart'}
            </div>
            <div className={s.placeholderContent}>
              <p>{ui.klineChartPlaceholder}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <StrategyGridNew
        strategies={strategies}
        onSelectStrategy={handleSelectStrategy}
        onEnterWorkspace={onEnterWorkspace}
        ui={ui}
        language={language}
      />
    </div>
  );
}
