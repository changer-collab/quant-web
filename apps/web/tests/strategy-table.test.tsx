import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrategyTable } from '../src/components/strategy-table';
import { getUiCopy, getStrategies } from '../src/appData';

const ui = getUiCopy('en');
const strategies = getStrategies('en');

describe('StrategyTable', () => {
  it('renders strategy names and types', () => {
    render(<StrategyTable strategies={strategies} ui={ui} />);
    expect(screen.getByText('Multi-Factor Selection')).toBeInTheDocument();
    expect(screen.getByText('Order Flow Momentum')).toBeInTheDocument();
    expect(screen.getByText('AI Alpha Mining')).toBeInTheDocument();
  });

  it('renders table headers from ui copy', () => {
    render(<StrategyTable strategies={strategies} ui={ui} />);
    expect(screen.getByText(ui.strategyTableHeaders.strategy)).toBeInTheDocument();
    expect(screen.getByText(ui.strategyTableHeaders.type)).toBeInTheDocument();
    expect(screen.getByText(ui.strategyTableHeaders.sharpe)).toBeInTheDocument();
  });

  it('shows workspace hint when interactive', () => {
    const onSelect = vi.fn();
    render(<StrategyTable strategies={strategies} ui={ui} onSelectStrategy={onSelect} />);
    expect(screen.getAllByText(ui.enterWorkspace).length).toBe(strategies.length);
  });

  it('shows sample label when not interactive', () => {
    render(<StrategyTable strategies={strategies} ui={ui} />);
    expect(screen.getAllByText(ui.strategySample).length).toBe(strategies.length);
  });

  it('calls onSelectStrategy when a row is clicked', () => {
    const onSelect = vi.fn();
    render(<StrategyTable strategies={strategies} ui={ui} onSelectStrategy={onSelect} />);
    fireEvent.click(screen.getByText('Multi-Factor Selection'));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'strategy-traditional-core' }));
  });

  it('marks selected strategy row', () => {
    const { container } = render(
      <StrategyTable strategies={strategies} ui={ui} selectedStrategyId="strategy-hft-l2" />,
    );
    const selectedRow = container.querySelector('[class*="selectedRow"]');
    expect(selectedRow).toBeInTheDocument();
  });
});
