import { useState, useCallback } from 'react';
import type { StrategyRow, UiCopy, LanguageCode, PreviewResponse } from '../appData';
import { StrategyGridNew } from './strategy-grid-new';
import { ConfigPanel } from './config-panel';
import { KlineChart } from './kline-chart';
import { fetchPreview } from '../api/preview';
import s from '../styles/strategy-page.module.css';

type ViewMode = 'grid' | 'config';

interface StrategyPageProps {
  strategies: StrategyRow[];
  onEnterWorkspace: (strategy: StrategyRow) => void;
  ui: UiCopy;
  language: LanguageCode;
}

export function StrategyPage({ strategies, onEnterWorkspace, ui, language }: StrategyPageProps) {
  const [view, setView] = useState<ViewMode>('grid');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [symbol, setSymbol] = useState('600519');
  const [klineLoading, setKlineLoading] = useState(false);

  function handleSelectStrategy(strategy: StrategyRow) {
    setSelectedStrategy(strategy);
    setView('config');
  }

  function handleBackToGrid() {
    setView('grid');
    setSelectedStrategy(null);
    setPreviewData(null);
  }

  function handlePreviewUpdate(data: PreviewResponse | null) {
    setPreviewData(data);
  }

  const handleSymbolChange = useCallback(
    async (newSymbol: string) => {
      if (!selectedStrategy) return;
      setSymbol(newSymbol);
      setKlineLoading(true);
      try {
        const data = await fetchPreview(selectedStrategy.name, {
          symbol: newSymbol,
          timeframe: '1d',
          limit: 100,
          preview_params: {},
        });
        setPreviewData(data);
      } catch {
        // 静默失败，保持现有数据
      } finally {
        setKlineLoading(false);
      }
    },
    [selectedStrategy]
  );

  const handleLoadMore = useCallback(
    async (cursor: number) => {
      if (!selectedStrategy || !previewData) return;
      setKlineLoading(true);
      try {
        const data = await fetchPreview(selectedStrategy.name, {
          symbol,
          timeframe: '1d',
          cursor,
          limit: 50,
          preview_params: {},
        });
        if (data.bars.length > 0) {
          setPreviewData({
            ...data,
            bars: [...data.bars, ...previewData.bars],
          });
        }
      } catch {
        // 静默失败
      } finally {
        setKlineLoading(false);
      }
    },
    [selectedStrategy, symbol, previewData]
  );

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
              {
                (ui.strategyCategoryLabels as Record<string, string>)[
                  selectedStrategy.category ?? 'non_factor'
                ]
              }
            </span>
            <span>·</span>
            <span>
              {
                (ui.strategySubcategoryLabels as Record<string, string>)[
                  selectedStrategy.subcategory ?? ''
                ]
              }
            </span>
          </div>
        </div>

        <div className={s.configLayout}>
          <div className={s.configPanel}>
            <ConfigPanel
              strategy={selectedStrategy}
              ui={ui}
              language={language}
              onPreviewUpdate={handlePreviewUpdate}
            />
          </div>
          <div className={s.klinePanel}>
            <div className={s.panelHeader}>{language === 'zh' ? 'K 线图' : 'K-Line Chart'}</div>
            <KlineChart
              previewData={previewData}
              subcategory={selectedStrategy.subcategory}
              ui={ui}
              language={language}
              onSymbolChange={handleSymbolChange}
              onLoadMore={handleLoadMore}
              loading={klineLoading}
            />
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
