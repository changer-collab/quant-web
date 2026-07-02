import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { mapBacktestResultToReport } from '../src/appData';
import { KeywordTileGrid } from '../src/components/report/KeywordTileGrid';
import {
  classifyKeywordTile,
  normalizeKeywordTiles,
  splitKeywordText,
} from '../src/components/report/keyword-tiles';

describe('keyword tile helpers', () => {
  it('splits Chinese AI assessment text into distinct keyword phrases', () => {
    expect(
      splitKeywordText('假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。')
    ).toEqual(['假设市场流动性充足', '未考虑冲击成本', '滑点恶化亏损', '基于日线回测']);
  });

  it('classifies fallback phrases by deterministic keyword rules', () => {
    expect(classifyKeywordTile('假设市场流动性充足')).toBe('assumption');
    expect(classifyKeywordTile('未考虑冲击成本')).toBe('limitation');
    expect(classifyKeywordTile('滑点恶化亏损')).toBe('risk');
    expect(classifyKeywordTile('交易样本偏少')).toBe('observation');
  });

  it('normalizes legacy text into classified tiles', () => {
    expect(
      normalizeKeywordTiles({
        fallbackText: '假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。',
      })
    ).toEqual([
      { text: '假设市场流动性充足', category: 'assumption' },
      { text: '未考虑冲击成本', category: 'limitation' },
      { text: '滑点恶化亏损', category: 'risk' },
      { text: '基于日线回测', category: 'assumption' },
    ]);
  });

  it('uses structured item categories before fallback classification', () => {
    expect(
      normalizeKeywordTiles({
        items: [{ text: '未考虑冲击成本', category: 'risk' }],
        fallbackText: '假设市场流动性充足',
      })
    ).toEqual([{ text: '未考虑冲击成本', category: 'risk' }]);
  });

  it('preserves an explicit empty structured items array instead of falling back to legacy text', () => {
    expect(
      normalizeKeywordTiles({
        items: [],
        fallbackText: '假设市场流动性充足；滑点恶化亏损',
      })
    ).toEqual([]);
  });

  it('falls back to legacy text when structured items is null from JSON', () => {
    expect(
      normalizeKeywordTiles({
        items: null as unknown as any,
        fallbackText: '假设市场流动性充足；滑点恶化亏损',
      })
    ).toEqual([
      { text: '假设市场流动性充足', category: 'assumption' },
      { text: '滑点恶化亏损', category: 'risk' },
    ]);
  });

  it('returns no tiles when maxItems is zero or less', () => {
    expect(
      normalizeKeywordTiles({
        fallbackText: '假设市场流动性充足；滑点恶化亏损',
        maxItems: 0,
      })
    ).toEqual([]);

    expect(
      normalizeKeywordTiles({
        fallbackText: '假设市场流动性充足；滑点恶化亏损',
        maxItems: -1,
      })
    ).toEqual([]);
  });

  it('ignores malformed structured items from JSON without crashing', () => {
    expect(
      normalizeKeywordTiles({
        items: [
          { text: '结构化流动性假设', category: 'assumption' },
          { category: 'risk' } as unknown as any,
          null as unknown as any,
        ],
        fallbackText: 'fallback should not matter',
      })
    ).toEqual([{ text: '结构化流动性假设', category: 'assumption' }]);
  });

  it('deduplicates phrases and applies the maximum tile count', () => {
    expect(
      normalizeKeywordTiles({
        fallbackText: '假设市场流动性充足；假设市场流动性充足；滑点恶化亏损；基于日线回测',
        maxItems: 2,
      })
    ).toEqual([
      { text: '假设市场流动性充足', category: 'assumption' },
      { text: '滑点恶化亏损', category: 'risk' },
    ]);
  });

  it('preserves structured AI issue keyword items when mapping backtest results', () => {
    const report = mapBacktestResultToReport({
      backtestResult: {
        config: {
          strategyName: 'dual_ma',
          timeframe: '1d',
          startDate: 1672588800000,
          endDate: 1735488000000,
          initialCash: 1000000,
          slippage: 0.001,
          strategyKind: 'timing',
        },
        metrics: {
          totalReturn: 0.1,
          annualizedReturn: 0.2,
          sharpeRatio: 1.5,
          maxDrawdown: -0.08,
          winRate: 0.6,
          totalTrades: 10,
        },
        equityCurve: [],
        drawdownCurve: [],
        monthlyReturns: [],
        annualReturns: [],
      },
      analysis: {
        issues: {
          liquidityAssessment: 'fallback should not matter',
          liquidityAssessmentItems: [
            { text: '结构化流动性假设', category: 'assumption' },
            { text: '结构化滑点风险', category: 'risk' },
          ],
          capacityEstimate: '容量估计文字',
          capacityEstimateItems: [{ text: '容量受成交额约束', category: 'limitation' }],
        },
      },
    });

    expect(report.issues.liquidityAssessmentItems).toEqual([
      { text: '结构化流动性假设', category: 'assumption' },
      { text: '结构化滑点风险', category: 'risk' },
    ]);
    expect(report.issues.capacityEstimateItems).toEqual([
      { text: '容量受成交额约束', category: 'limitation' },
    ]);
  });

  it('renders fallback phrases as keyword tiles with category labels', () => {
    render(
      <KeywordTileGrid
        title="流动性评估"
        fallbackText="假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。"
      />
    );

    expect(screen.getByText('流动性评估')).toBeInTheDocument();
    expect(screen.getByText('假设市场流动性充足')).toBeInTheDocument();
    expect(screen.getByText('未考虑冲击成本')).toBeInTheDocument();
    expect(screen.getByText('滑点恶化亏损')).toBeInTheDocument();
    expect(screen.getByText('基于日线回测')).toBeInTheDocument();
    expect(screen.getAllByText('假设').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('限制')).toBeInTheDocument();
    expect(screen.getByText('风险')).toBeInTheDocument();
  });
});
