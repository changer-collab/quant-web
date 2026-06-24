import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useResearchWorkflow } from '../src/hooks/useResearchWorkflow';

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

describe('Research workflow integration', () => {
  it('complete flow: select strategy → run research → view report', async () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));

    expect(result.current.state.activePage).toBe('dashboard');

    act(() => result.current.handleNavClick('strategies'));
    expect(result.current.state.activePage).toBe('strategies');

    const strategy = {
      id: 'strategy-hft-l2',
      mode: 'hft' as const,
      name: 'CATL',
      type: 'HFT',
      return: '+22%',
      drawdown: '-4%',
      sharpe: '3.1',
      status: 'Stable',
    };
    act(() => result.current.handleSelectStrategy(strategy));
    expect(result.current.state.activePage).toBe('workspace');
    expect(result.current.activeMode).toBe('hft');

    act(() => result.current.handleRunResearch());
    expect(result.current.state.activePage).toBe('jobs');

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

  it('complete flow in Chinese', async () => {
    const { result } = renderHook(() => useResearchWorkflow('zh'));

    const strategy = {
      id: 'strategy-hft-l2',
      mode: 'hft' as const,
      name: 'CATL',
      type: 'HFT',
      return: '+22%',
      drawdown: '-4%',
      sharpe: '3.1',
      status: 'Stable',
    };
    act(() => result.current.handleSelectStrategy(strategy));
    act(() => result.current.handleRunResearch());

    await waitFor(() => {
      expect(result.current.localizedJobs.length).toBeGreaterThan(0);
    }, { timeout: 5000 });
    await waitFor(() => {
      expect(result.current.localizedJobs[0].state).toBe('已完成');
    }, { timeout: 5000 });

    await waitFor(() => {
      expect(result.current.reportJobIds.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const jobWithReport = result.current.localizedJobs.find((job) =>
      result.current.reportJobIds.includes(job.id),
    );
    expect(jobWithReport).toBeDefined();

    act(() => result.current.handleViewReport(jobWithReport!));
    expect(result.current.activeReport).toBeDefined();
  });

  it('mode switching preserves workspace navigation', async () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));

    act(() => result.current.setActiveMode('ai'));
    expect(result.current.researchMode.id).toBe('ai');

    act(() => result.current.handleNavClick('workspace'));
    expect(result.current.state.activePage).toBe('workspace');

    const strategy = {
      id: 'strategy-ai-ml',
      mode: 'ai' as const,
      name: 'AI Strategy',
      type: 'AI/ML',
      return: '+15%',
      drawdown: '-3%',
      sharpe: '2.0',
      status: 'Stable',
    };
    act(() => result.current.handleSelectStrategy(strategy));

    act(() => result.current.handleRunResearch());

    await waitFor(() => {
      expect(result.current.localizedJobs.length).toBeGreaterThan(0);
    }, { timeout: 5000 });

    const job = result.current.localizedJobs[0];
    expect(job.kind).toContain('AI');
  });
});
