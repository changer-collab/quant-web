import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspacePage } from '../src/components/workspace-page';
import { getUiCopy } from '../src/appData';
import type { StrategyRow } from '../src/appData';

const apiMockState = vi.hoisted(() => ({
  savedTaskPayloads: [] as Array<Record<string, unknown>>,
}));

vi.mock('../src/api/client', () => ({
  apiPost: vi.fn().mockResolvedValue({ id: 'diagnostics-task', status: 'pending' }),
}));

vi.mock('../src/api/diagnostics', () => ({
  fetchDiagnostic: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/api/strategies-config', () => ({
  fetchStrategyConfig: vi.fn().mockResolvedValue({
    persisted: true,
    configSnapshot: { strategy: 'dual_ma', params: { symbol: '000001', timeframe: '1h', initialCash: 2_000_000 } },
    config_json: { symbol: '000001', timeframe: '1h', initialCash: 2_000_000 },
    hash: 'hash',
    updated_at: 1,
  }),
}));

vi.mock('../src/api/tasks', () => ({
  submitBacktest: vi.fn().mockImplementation((payload: Record<string, unknown>) => {
    apiMockState.savedTaskPayloads.push(payload);
    return Promise.resolve({ id: 'backtest-task', status: 'pending' });
  }),
  streamTask: vi.fn().mockImplementation((taskId: string, onEvent: (event: any) => void) => {
    const timer = setTimeout(() => {
      if (taskId === 'diagnostics-task') {
        onEvent({
          type: 'result',
          taskId,
          data: {
            resultId: 'diag-1',
            data: {
              type: 'non_factor',
              param_sensitivity: [],
              signal_quality: {
                total_signals: 0,
                win_rate: 0,
                avg_holding_bars: 0,
                profit_factor: 0,
              },
              slippage_stress: [],
            },
          },
        });
      } else {
        onEvent({
          type: 'result',
          taskId,
          data: {
            backtestResult: {
              metrics: {
                totalReturn: 0.1234,
                maxDrawdown: -0.0456,
                sharpeRatio: 1.78,
                totalTrades: 2,
              },
              equityCurve: [
                { timestamp: 1704067200000, equity: 1_000_000 },
                { timestamp: 1704153600000, equity: 1_123_400 },
              ],
              trades: [
                {
                  timestamp: 1704067200000,
                  side: 'buy',
                  price: 10,
                  quantity: 100,
                  pnl: 0,
                  reason: 'entry',
                },
                {
                  timestamp: 1704153600000,
                  side: 'sell',
                  price: 11.23,
                  quantity: 100,
                  pnl: 123,
                  reason: 'exit',
                },
              ],
            },
          },
        });
      }
    }, 0);
    return () => clearTimeout(timer);
  }),
}));

const strategy: StrategyRow = {
  id: 'dual_ma',
  mode: 'traditional',
  name: 'dual_ma',
  type: '趋势跟踪策略',
  return: '+0%',
  drawdown: '0%',
  sharpe: '0',
  status: 'stable',
  description: 'dual ma',
  category: 'non_factor',
  subcategory: 'trend_cta',
  workflowReady: true,
  params: [],
};

describe('WorkspacePage', () => {
  beforeEach(() => {
    apiMockState.savedTaskPayloads = [];
  });

  it('renders real backtest result instead of static mock metrics', async () => {
    const user = userEvent.setup();

    render(
      <WorkspacePage strategy={strategy} onBack={vi.fn()} language="zh" ui={getUiCopy('zh')} />
    );

    await user.click(screen.getByRole('button', { name: '开始诊断' }));
    await screen.findByRole('button', { name: '确认 → 进入回测' });
    await user.click(screen.getByRole('button', { name: '确认 → 进入回测' }));
    await user.click(screen.getByRole('button', { name: '提交回测' }));

    await waitFor(() => {
      expect(screen.getByText('12.34%')).toBeInTheDocument();
    });
    expect(screen.queryByText('35.2%')).not.toBeInTheDocument();
    expect(apiMockState.savedTaskPayloads[0]).toEqual(
      expect.objectContaining({
        symbol: '000001',
        timeframe: '1h',
        initialCash: 2_000_000,
      })
    );
  });
});
