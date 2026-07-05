import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrategyGridNew } from '../src/components/strategy-grid-new';
import type { StrategyRow, UiCopy, LanguageCode } from '../src/appData';

const mockUi = {
  emptyStrategies: 'No strategies',
  enterWorkspace: 'Enter Workspace',
  strategyCategoryLabels: { factor_based: 'Factor', non_factor: 'Non-Factor', transitional: 'Transitional' },
  strategySubcategoryLabels: {},
} as unknown as UiCopy;

const mockStrategies: StrategyRow[] = [
  { id: 's1', name: 'dual_ma', description: '双均线', category: 'non_factor', subcategory: 'trend_cta', workflowReady: true, params: [] } as any,
  { id: 's2', name: 'rsi_reversal', description: 'RSI反转', category: 'non_factor', subcategory: 'trend_cta', workflowReady: false, params: [] } as any,
];

describe('StrategyGridNew', () => {
  it('groups strategies by category and subcategory', () => {
    render(
      <StrategyGridNew
        strategies={mockStrategies}
        onEnterWorkspace={() => {}}
        ui={mockUi}
        language={'zh' as LanguageCode}
      />
    );
    expect(screen.getByText('双均线')).toBeDefined();
    expect(screen.getByText('RSI反转')).toBeDefined();
  });

  it('clicking a card calls onEnterWorkspace', () => {
    const onEnter = vi.fn();
    render(
      <StrategyGridNew
        strategies={mockStrategies}
        onEnterWorkspace={onEnter}
        ui={mockUi}
        language={'zh' as LanguageCode}
      />
    );
    fireEvent.click(screen.getByText('双均线'));
    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ name: 'dual_ma' }));
  });

  it('does not call onEnterWorkspace when workflowReady is false', () => {
    const onEnter = vi.fn();
    render(
      <StrategyGridNew
        strategies={mockStrategies}
        onEnterWorkspace={onEnter}
        ui={mockUi}
        language={'zh' as LanguageCode}
      />
    );
    fireEvent.click(screen.getByText('RSI反转'));
    expect(onEnter).not.toHaveBeenCalled();
  });
});
