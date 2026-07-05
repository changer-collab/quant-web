import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkspacePage } from '../src/components/workspace-page';
import { getUiCopy } from '../src/appData';
import type { StrategyRow, UiCopy, LanguageCode } from '../src/appData';

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
  saveStrategyConfig: vi.fn().mockResolvedValue({ ok: true, hash: 'hash', updated_at: 1 }),
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

vi.mock('../src/api/preview', () => ({
  fetchPreview: vi.fn().mockResolvedValue({
    bars: [],
    signals: [],
    pagination: { next_cursor: null, has_more: false },
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

// ── 供三 Tab 交互用例使用的精简 mock ──
const mockUi = {
  workspaceBackButton: 'Back',
  workspaceStep1Label: 'Diagnose',
  workspaceStep1Desc: 'Run diagnostics',
  workspaceStep2Label: 'Backtest',
  workspaceStep2Desc: 'Run backtest',
  workspaceRunDiagnostics: 'Run Diagnostics',
  workspaceConfirmStep2: 'Next',
  workspaceDiagnosticsRunning: 'Running...',
  workspaceDiagnosticsFailed: 'Failed',
  workspaceDiagnosticExpired: 'Expired',
  workspaceBacktestFailed: 'Failed',
  workspaceBacktestRunning: 'Running...',
  workspaceSubmitBacktest: 'Submit',
  workspaceBacktestConfigTitle: 'Config',
  workspaceBacktestSymbol: 'Symbol',
  workspaceBacktestTimeframe: 'Timeframe',
  workspaceBacktestInitialCapital: 'Capital',
  workspaceBacktestStartDate: 'Start',
  workspaceBacktestEndDate: 'End',
  workspaceConfigSummary: 'Summary',
  workspacePerformanceTitle: 'Performance',
  workspaceEquityCurve: 'Equity',
  workspaceTradeDetails: 'Trades',
  workspaceICSeries: 'IC',
  workspaceLayeredReturns: 'Layers',
  workspaceCorrelationHeatmap: 'Correlation',
  workspaceParamSensitivity: 'Sensitivity',
  workspaceSignalDist: 'Signal',
  workspaceSlippageStress: 'Slippage',
  workspaceSignalMetrics: 'Metrics',
  configPanelSaved: 'Saved',
  configPanelSave: 'Save',
  configPanelSaving: 'Saving',
  configPanelPreview: 'Preview',
  configPanelSubmitTask: 'Submit Task',
  configPanelSaveError: 'Save failed',
  configPanelBasicParams: 'Params',
  configPanelCategoryTabs: { factor_based: 'F', non_factor: 'N', transitional: 'T' },
  configPanelFactorPool: 'Factor Pool',
  configPanelFactorPoolPlaceholder: 'Search',
  configPanelPreprocessing: 'Preprocess',
  configPanelWinsorization: 'Winsor',
  configPanelNeutralization: 'Neutral',
  configPanelStandardization: 'Standard',
  configPanelWindowParams: 'Window',
  configPanelLookbackWindow: 'Lookback',
  configPanelHoldPeriod: 'Hold',
  configPanelIndicatorToolbox: 'Indicators',
  configPanelMACD: 'MACD',
  configPanelRSI: 'RSI',
  configPanelBollinger: 'Bollinger',
  configPanelDynamicParams: 'Dynamic',
  configPanelDataSource: 'Data Source',
  configPanelDecayHalfLife: 'Decay',
  configPanelMappingTarget: 'Mapping',
  klineChartSymbolSearch: 'Search',
  klineChartLoading: 'Loading',
  klineChartPreviewEngine: 'Preview',
  klineChartPreviewEngineTooltip: 'Tooltip',
  klineChartOHLC: 'OHLC',
  klineChartBuy: 'Buy',
  klineChartSell: 'Sell',
  klineChartReason: 'Reason',
  klineChartFactorSnapshot: 'Factors',
  klineChartFingerprintChanged: 'Changed',
  klineChartRSI: 'RSI',
  klineChartSpread: 'Spread',
  klineChartIC: 'IC',
  klineChartSentiment: 'Sentiment',
  strategySubcategoryLabels: {},
  workspaceTabConfig: '参数配置',
  workspaceTabDiagnose: '诊断',
  workspaceTabBacktest: '回测',
  workspaceNoConfigHint: '请先保存配置',
} as unknown as UiCopy;

const mockStrategy = {
  id: 's1',
  name: 'dual_ma',
  description: '双均线',
  category: 'non_factor',
  subcategory: 'trend_cta',
  params: [],
} as unknown as StrategyRow;

describe('WorkspacePage', () => {
  beforeEach(() => {
    apiMockState.savedTaskPayloads = [];
  });

  it('renders real backtest result instead of static mock metrics', async () => {
    const user = userEvent.setup();

    render(
      <WorkspacePage strategy={strategy} onBack={vi.fn()} language="zh" ui={getUiCopy('zh')} />
    );

    // 新 UI：默认在「参数配置」Tab，需先切换到「诊断」Tab
    await user.click(screen.getByText('诊断'));

    await user.click(screen.getByRole('button', { name: '开始诊断' }));

    // 旧 Stepper 的「确认 → 进入回测」按钮已移除，等待诊断内容渲染完成
    await screen.findByText('信号数量/质量分布');

    // 切换到「回测」Tab（替代旧 Stepper 的 step 2）
    await user.click(screen.getByText('回测'));

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

  it('defaults to config tab', () => {
    render(
      <WorkspacePage
        strategy={mockStrategy}
        onBack={() => {}}
        language={'zh' as LanguageCode}
        ui={mockUi}
      />
    );
    expect(screen.getByText('参数配置')).toBeDefined();
  });

  it('switches to diagnose tab on click', async () => {
    render(
      <WorkspacePage
        strategy={mockStrategy}
        onBack={() => {}}
        language={'zh' as LanguageCode}
        ui={mockUi}
      />
    );
    // 等待 configSnapshot 异步加载完成（fetchStrategyConfig 已 resolve）
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(screen.getByText('诊断'));
    expect(screen.getByText('Run Diagnostics')).toBeDefined();
  });

  it('switches to backtest tab on click', async () => {
    render(
      <WorkspacePage
        strategy={mockStrategy}
        onBack={() => {}}
        language={'zh' as LanguageCode}
        ui={mockUi}
      />
    );
    // 等待 configSnapshot 异步加载完成（fetchStrategyConfig 已 resolve）
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(screen.getByText('回测'));
    expect(screen.getByText('Symbol')).toBeDefined();
  });
});
