import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResearchWorkflow } from '../src/hooks/useResearchWorkflow';
import { getStrategies } from '../src/appData';

vi.mock('../src/api/reports', () => ({
  fetchReports: vi.fn().mockResolvedValue([]),
  fetchReport: vi.fn().mockResolvedValue(null),
}));

const mockStrategy = {
  id: 'strategy-traditional-core',
  mode: 'traditional' as const,
  name: 'Test Strategy',
  type: 'Traditional',
  return: '+10%',
  drawdown: '-5%',
  sharpe: '1.5',
  status: 'Stable',
};

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderWorkflow(language: 'en' | 'zh' = 'en') {
  const view = renderHook(() => useResearchWorkflow(language));
  await flushAsyncWork();
  return view;
}

function registerResult(
  result: { current: ReturnType<typeof useResearchWorkflow> },
  overrides: Partial<{
    taskId: string;
    strategy: ReturnType<typeof getStrategies>[number];
    symbol: string;
    initialCash: number;
    startTs: number;
    endTs: number;
  }> = {}
) {
  act(() => {
    result.current.registerBacktestResult({
      taskId: overrides.taskId ?? 'task-1',
      taskResult: { backtestResult: {} },
      strategy: overrides.strategy ?? mockStrategy,
      config: {
        symbol: overrides.symbol ?? '600519',
        timeframe: '1d',
        initialCash: overrides.initialCash ?? 1_000_000,
        startTs: overrides.startTs ?? new Date('2023-01-02T00:00:00').getTime(),
        endTs: overrides.endTs ?? new Date('2024-12-30T00:00:00').getTime(),
      },
    });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useResearchWorkflow', () => {
  it('initializes with dashboard as active page', async () => {
    const { result } = await renderWorkflow('en');
    expect(result.current.state.activePage).toBe('dashboard');
  });

  it('switches active page on nav click', async () => {
    const { result } = await renderWorkflow('en');
    act(() => result.current.handleNavClick('strategy'));
    expect(result.current.state.activePage).toBe('strategy');
  });

  it('ignores invalid page ids', async () => {
    const { result } = await renderWorkflow('en');
    act(() => result.current.handleNavClick('invalid-page'));
    expect(result.current.state.activePage).toBe('dashboard');
  });

  it('does nothing when viewing report for a job without one', async () => {
    const { result } = await renderWorkflow('en');
    const fakeJob = {
      id: 'nonexistent',
      name: 'Fake',
      kind: 'Test',
      state: 'Running',
      progress: 50,
      strategyName: 'Fake',
    };
    act(() => result.current.handleViewReport(fakeJob));
    expect(result.current.state.activePage).toBe('dashboard');
  });

  it('registers a backtest result and exposes it as the active report', async () => {
    const { result } = await renderWorkflow('en');

    registerResult(result, { taskId: 'task-123' });

    expect(result.current.reportJobIds).toContain('task-123');
    expect(result.current.backtestReports.length).toBe(1);
    expect(result.current.activeReport).toBeDefined();
    expect(result.current.activeReport?.jobId).toBe('task-123');
    expect(result.current.activeBacktestReport).toBeDefined();
    expect(result.current.activeBacktestReport?.taskId).toBe('task-123');
  });

  it('navigates to backtest page when viewing a registered report', async () => {
    const { result } = await renderWorkflow('en');

    registerResult(result, { taskId: 'task-456' });

    const jobWithReport = {
      id: 'task-456',
      name: 'Test Strategy',
      kind: 'traditional',
      state: 'Completed',
      progress: 100,
      strategyName: 'Test Strategy',
    };
    act(() => result.current.handleViewReport(jobWithReport));
    expect(result.current.state.activePage).toBe('backtest');
    expect(result.current.activeReport).toBeDefined();
  });

  it('keeps the most recent report active after multiple registrations', async () => {
    const { result } = await renderWorkflow('en');

    registerResult(result, { taskId: 'task-a' });
    const firstReportId = result.current.activeReport?.id;
    expect(firstReportId).toBeDefined();

    registerResult(result, { taskId: 'task-b' });
    expect(result.current.reportJobIds).toEqual(['task-b', 'task-a']);
    expect(result.current.activeReport?.jobId).toBe('task-b');
  });

  it('preserves backtest config in the registered report (zh)', async () => {
    const strategy = getStrategies('zh').find((item) => item.id === 'dual_ma');
    const { result } = await renderWorkflow('zh');

    registerResult(result, {
      taskId: 'task-zh',
      strategy: strategy!,
      symbol: '600519',
      initialCash: 2_000_000,
      startTs: new Date('2023-01-02T00:00:00').getTime(),
      endTs: new Date('2024-12-30T00:00:00').getTime(),
    });

    expect(result.current.activeReport).toBeDefined();
    expect(result.current.activeBacktestReport).toBeDefined();
    expect(result.current.activeBacktestReport?.overview.timeRange).toEqual({
      start: '2023-01-02',
      end: '2024-12-30',
    });
    expect(result.current.activeBacktestReport?.dataParams.capital.initialCash).toBe(2_000_000);
  });

  it('switches active backtest report via handleSwitchBacktestReport', async () => {
    const { result } = await renderWorkflow('en');

    registerResult(result, { taskId: 'task-first' });
    const firstReportId = result.current.activeReport?.id;
    registerResult(result, { taskId: 'task-second' });
    expect(result.current.activeReport?.jobId).toBe('task-second');

    act(() => result.current.handleSwitchBacktestReport(`backtest-full-${firstReportId}`));
    expect(result.current.activeReport?.id).toBe(firstReportId);
  });
});
