import { beforeEach, describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResearchWorkflow } from '../src/hooks/useResearchWorkflow';
import { getStrategies } from '../src/appData';

const taskApiMockState = vi.hoisted(() => ({
  streamHandlers: new Map<string, (event: any) => void>(),
}));

vi.mock('../src/api/reports', () => ({
  fetchReports: vi.fn().mockResolvedValue([]),
  fetchReport: vi.fn().mockResolvedValue(null),
}));

vi.mock('../src/api/tasks', () => ({
  submitBacktest: vi.fn().mockResolvedValue({ id: 'task-1', status: 'pending' }),
  streamTask: vi.fn().mockImplementation((taskId: string, onEvent: (event: any) => void) => {
    taskApiMockState.streamHandlers.set(taskId, onEvent);
    return () => taskApiMockState.streamHandlers.delete(taskId);
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

async function runResearch(result: { current: ReturnType<typeof useResearchWorkflow> }) {
  act(() => result.current.handleRunResearch());
  await flushAsyncWork();
}

function emitTaskEvent(event: any) {
  const handler = taskApiMockState.streamHandlers.get(event.taskId);
  if (!handler) throw new Error(`No stream handler registered for task ${event.taskId}`);
  act(() => handler(event));
}

beforeEach(() => {
  taskApiMockState.streamHandlers.clear();
  vi.clearAllMocks();
});

describe('useResearchWorkflow', () => {
  it('initializes with dashboard as active page', async () => {
    const { result } = await renderWorkflow('en');
    expect(result.current.state.activePage).toBe('dashboard');
  });

  it('switches active page on nav click', async () => {
    const { result } = await renderWorkflow('en');
    act(() => result.current.handleNavClick('strategies'));
    expect(result.current.state.activePage).toBe('strategies');
  });

  it('ignores invalid page ids', async () => {
    const { result } = await renderWorkflow('en');
    act(() => result.current.handleNavClick('invalid-page'));
    expect(result.current.state.activePage).toBe('dashboard');
  });

  it('navigates to workspace on strategy select', async () => {
    const { result } = await renderWorkflow('en');
    act(() => result.current.handleSelectStrategy(mockStrategy));
    expect(result.current.state.activePage).toBe('workspace');
  });

  it('navigates to jobs page when running research', async () => {
    const { result } = await renderWorkflow('en');
    act(() => result.current.handleSelectStrategy(mockStrategy));
    await runResearch(result);

    expect(result.current.state.activePage).toBe('jobs');
    expect(result.current.localizedJobs.length).toBeGreaterThan(0);
  });

  it('navigates to report page when viewing a report', async () => {
    const { result } = await renderWorkflow('en');
    act(() => result.current.handleSelectStrategy(mockStrategy));
    await runResearch(result);
    emitTaskEvent({ type: 'result', taskId: 'task-1', data: { backtestResult: {} } });

    expect(result.current.reportJobIds.length).toBeGreaterThan(0);
    const jobWithReport = result.current.localizedJobs.find((job) =>
      result.current.reportJobIds.includes(job.id)
    );
    expect(jobWithReport).toBeDefined();
    act(() => result.current.handleViewReport(jobWithReport!));
    expect(result.current.state.activePage).toBe('backtest');
    expect(result.current.activeReport).toBeDefined();
  });

  it('uses selected backtest configuration in generated report diagnostics', async () => {
    const strategy = getStrategies('zh').find((item) => item.id === 'dual_ma');
    const { result } = await renderWorkflow('zh');

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
    await runResearch(result);
    emitTaskEvent({ type: 'result', taskId: 'task-1', data: { backtestResult: {} } });

    expect(result.current.activeReport).toBeDefined();
    const activeReport = result.current.activeReport!;
    const runConfigSection = activeReport.diagnostics.find(
      (section) => section.title === '运行配置'
    );
    const flattenedDiagnostics = activeReport.diagnostics.flatMap((section) => section.items);

    expect(runConfigSection?.items).toContain('回测区间: 2023-2024');
    expect(runConfigSection?.items).toContain('起止日期: 2023-01-02 ~ 2024-12-30');
    expect(runConfigSection?.items).toContain('标的代码: 600519');
    expect(runConfigSection?.items).toContain('初始资金: 2,000,000');
    expect(runConfigSection?.items).not.toContain('回测区间: 2021-2025');
    expect(flattenedDiagnostics).toContain('策略类型: 趋势跟踪策略');
    expect(flattenedDiagnostics).toContain('参数: 短均线周期=7, 长均线周期=30');
    expect(result.current.activeBacktestReport?.overview.timeRange).toEqual({
      start: '2023-01-02',
      end: '2024-12-30',
    });
    expect(result.current.activeBacktestReport?.dataParams.capital.initialCash).toBe(2_000_000);
    expect(result.current.activeBacktestReport?.dataParams.params).toEqual([
      { label: '短均线周期', value: '7' },
      { label: '长均线周期', value: '30' },
    ]);
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

  it('localizes jobs when language changes', async () => {
    const { result } = await renderWorkflow('zh');
    act(() => result.current.handleSelectStrategy(mockStrategy));
    await runResearch(result);
    emitTaskEvent({ type: 'status', taskId: 'task-1', message: 'completed', percent: 100 });

    expect(result.current.localizedJobs.length).toBeGreaterThan(0);
    expect(result.current.localizedJobs[0].state).toBe('已完成');
  });
});
