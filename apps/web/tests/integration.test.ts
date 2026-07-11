import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResearchWorkflow } from '../src/hooks/useResearchWorkflow';
import { getStrategies } from '../src/appData';

vi.mock('../src/api/reports', () => ({
  fetchReports: vi.fn().mockResolvedValue([]),
  fetchReport: vi.fn().mockResolvedValue(null),
}));

describe('Research workflow integration', () => {
  it('complete flow: register backtest result → view report', async () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));

    expect(result.current.state.activePage).toBe('dashboard');
    expect(result.current.reportJobIds).toEqual([]);

    act(() => result.current.handleNavClick('strategy'));
    expect(result.current.state.activePage).toBe('strategy');

    const strategy = getStrategies('en').find((item) => item.id === 'dual_ma')!;

    act(() => {
      result.current.registerBacktestResult({
        taskId: 'task-int-1',
        taskResult: { backtestResult: { metrics: { totalReturn: 0.2 } } },
        strategy,
        config: {
          symbol: '600519',
          timeframe: '1d',
          initialCash: 1_000_000,
          startTs: new Date('2023-01-02T00:00:00').getTime(),
          endTs: new Date('2024-12-30T00:00:00').getTime(),
        },
      });
    });

    expect(result.current.reportJobIds).toContain('task-int-1');
    expect(result.current.backtestReports.length).toBe(1);
    expect(result.current.activeReport).toBeDefined();
    expect(result.current.activeReport?.jobId).toBe('task-int-1');
    expect(result.current.activeBacktestReport).toBeDefined();

    const jobWithReport = {
      id: 'task-int-1',
      name: strategy.name,
      kind: 'traditional',
      state: 'Completed',
      progress: 100,
      strategyName: strategy.name,
    };
    act(() => result.current.handleViewReport(jobWithReport));
    expect(result.current.state.activePage).toBe('backtest');
    expect(result.current.activeReport).toBeDefined();
  });

  it('complete flow in Chinese', async () => {
    const { result } = renderHook(() => useResearchWorkflow('zh'));

    const strategy = getStrategies('zh').find((item) => item.id === 'dual_ma')!;

    act(() => {
      result.current.registerBacktestResult({
        taskId: 'task-int-zh',
        taskResult: { backtestResult: {} },
        strategy,
        config: {
          symbol: '600519',
          timeframe: '1d',
          initialCash: 2_000_000,
          startTs: new Date('2023-01-02T00:00:00').getTime(),
          endTs: new Date('2024-12-30T00:00:00').getTime(),
        },
      });
    });

    expect(result.current.activeReport).toBeDefined();
    expect(result.current.activeBacktestReport).toBeDefined();
    expect(result.current.activeBacktestReport?.overview.timeRange).toEqual({
      start: '2023-01-02',
      end: '2024-12-30',
    });
    expect(result.current.activeBacktestReport?.dataParams.capital.initialCash).toBe(2_000_000);

    const jobWithReport = {
      id: 'task-int-zh',
      name: strategy.name,
      kind: 'traditional',
      state: '已完成',
      progress: 100,
      strategyName: strategy.name,
    };
    act(() => result.current.handleViewReport(jobWithReport));
    expect(result.current.state.activePage).toBe('backtest');
  });

  it('navigates to workspace before registering a result', async () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));

    act(() => result.current.handleNavClick('workspace'));
    expect(result.current.state.activePage).toBe('workspace');

    const strategy = getStrategies('en').find((item) => item.id === 'strategy-ai-micro-alpha')!;

    act(() => {
      result.current.registerBacktestResult({
        taskId: 'task-int-ai',
        taskResult: { backtestResult: {} },
        strategy,
        config: {
          symbol: '000001',
          timeframe: '1d',
          initialCash: 1_000_000,
          startTs: new Date('2023-01-02T00:00:00').getTime(),
          endTs: new Date('2024-12-30T00:00:00').getTime(),
        },
      });
    });

    expect(result.current.reportJobIds).toContain('task-int-ai');
    expect(result.current.activeReport?.mode).toBe(strategy.mode);
  });

  it('can navigate to the research distillation page', async () => {
    const { result } = renderHook(() => useResearchWorkflow('zh'));

    act(() => result.current.handleNavClick('research'));

    expect(result.current.state.activePage).toBe('research');
  });
});
