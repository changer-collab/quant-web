import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useResearchWorkflow } from '../src/hooks/useResearchWorkflow';
import { getStrategies } from '../src/appData';

vi.mock('../src/api/reports', () => ({
  fetchReports: vi.fn().mockResolvedValue([]),
  fetchReport: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/api/tasks', () => ({
  submitBacktest: vi.fn().mockResolvedValue({ id: 'task-1', status: 'pending' }),
  streamTask: vi.fn().mockImplementation((_taskId: string, onEvent: (e: any) => void) => {
    const t1 = setTimeout(() => {
      onEvent({ type: 'status', taskId: 'task-1', message: 'completed', percent: 100 });
      setTimeout(() => {
        onEvent({ type: 'result', taskId: 'task-1', data: { backtestResult: {} } });
      }, 10);
    }, 10);
    return () => clearTimeout(t1);
  }),
  fetchTasks: vi.fn().mockResolvedValue([]),
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

describe('useResearchWorkflow', () => {
  it('initializes with dashboard as active page', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    expect(result.current.state.activePage).toBe('dashboard');
  });

  it('initializes with traditional as default mode', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    expect(result.current.activeMode).toBe('traditional');
  });

  it('switches active page on nav click', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    act(() => result.current.handleNavClick('strategies'));
    expect(result.current.state.activePage).toBe('strategies');
  });

  it('ignores invalid page ids', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    act(() => result.current.handleNavClick('invalid-page'));
    expect(result.current.state.activePage).toBe('dashboard');
  });

  it('switches mode and navigates to workspace on strategy select', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    act(() => result.current.handleSelectStrategy(mockStrategy));
    expect(result.current.activeMode).toBe('traditional');
    expect(result.current.state.activePage).toBe('workspace');
  });

  it('navigates to jobs page when running research', async () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    act(() => result.current.handleSelectStrategy(mockStrategy));
    act(() => result.current.handleRunResearch());
    expect(result.current.state.activePage).toBe('jobs');
    await waitFor(() => {
      expect(result.current.localizedJobs.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
  });

  it('navigates to report page when viewing a report', async () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    act(() => result.current.handleSelectStrategy(mockStrategy));
    act(() => result.current.handleRunResearch());
    await waitFor(() => {
      expect(result.current.localizedJobs.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(result.current.reportJobIds.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
    const jobWithReport = result.current.localizedJobs.find((job) =>
      result.current.reportJobIds.includes(job.id),
    );
    expect(jobWithReport).toBeDefined();
    act(() => result.current.handleViewReport(jobWithReport!));
    expect(result.current.state.activePage).toBe('backtest');
    expect(result.current.activeReport).toBeDefined();
  });

  it('uses selected backtest configuration in generated report diagnostics', async () => {
    const strategy = getStrategies('zh').find((item) => item.id === 'dual_ma');
    const { result } = renderHook(() => useResearchWorkflow('zh'));

    act(() => result.current.handleSelectStrategy(strategy!));
    act(() => {
      result.current.setBacktestConfig((current) => ({
        ...current,
        symbol: '600519',
        timeframe: '1d',
        startTs: new Date('2023-01-02T00:00:00').getTime(),
        endTs: new Date('2024-12-30T00:00:00').getTime(),
        initialCash: 2_000_000,
        slippage: 0.002,
        params: { short_period: 7, long_period: 30 },
      }));
    });
    act(() => result.current.handleRunResearch());

    await waitFor(() => {
      expect(result.current.activeReport).toBeDefined();
    }, { timeout: 5000 });

    const activeReport = result.current.activeReport!;
    const runConfigSection = activeReport.diagnostics.find((section) => section.title === '运行配置');
    const flattenedDiagnostics = activeReport.diagnostics.flatMap((section) => section.items);

    expect(runConfigSection?.items).toContain('回测区间: 2023-2024');
    expect(runConfigSection?.items).toContain('起止日期: 2023-01-02 ~ 2024-12-30');
    expect(runConfigSection?.items).toContain('标的代码: 600519');
    expect(runConfigSection?.items).toContain('初始资金: 2,000,000');
    expect(runConfigSection?.items).not.toContain('回测区间: 2021-2025');
    expect(flattenedDiagnostics).toContain('策略类型: 趋势跟踪策略');
    expect(flattenedDiagnostics).toContain('参数: 短均线周期=7, 长均线周期=30');
    expect(result.current.activeBacktestReport?.overview.timeRange).toEqual({ start: '2023-01-02', end: '2024-12-30' });
    expect(result.current.activeBacktestReport?.dataParams.capital.initialCash).toBe(2_000_000);
    expect(result.current.activeBacktestReport?.dataParams.params).toEqual([
      { label: '短均线周期', value: '7' },
      { label: '长均线周期', value: '30' },
    ]);
  });

  it('does nothing when viewing report for a job without one', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
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

  it('changes research mode', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));
    act(() => result.current.setActiveMode('ai'));
    expect(result.current.activeMode).toBe('ai');
    expect(result.current.researchMode.id).toBe('ai');
  });

  it('localizes jobs when language changes', async () => {
    const { result: zhResult } = renderHook(() => useResearchWorkflow('zh'));
    act(() => zhResult.current.handleSelectStrategy(mockStrategy));
    act(() => zhResult.current.handleRunResearch());
    await waitFor(() => {
      expect(zhResult.current.localizedJobs.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(zhResult.current.localizedJobs[0].state).toBe('已完成');
    }, { timeout: 5000 });
  });
});
