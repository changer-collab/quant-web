import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useResearchWorkflow } from '../src/hooks/useResearchWorkflow';

describe('Research workflow integration', () => {
  it('complete flow: select strategy → run research → view report', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));

    // Start on dashboard
    expect(result.current.state.activePage).toBe('dashboard');

    // Navigate to strategies
    act(() => result.current.handleNavClick('strategies'));
    expect(result.current.state.activePage).toBe('strategies');

    // Select a strategy — navigates to workspace
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

    // Run research — creates job and report, navigates to jobs
    act(() => result.current.handleRunResearch());
    expect(result.current.state.activePage).toBe('jobs');
    expect(result.current.localizedJobs.length).toBeGreaterThan(0);

    // Find a job with a report
    const jobWithReport = result.current.localizedJobs.find((job) =>
      result.current.reportJobIds.includes(job.id),
    );
    expect(jobWithReport).toBeDefined();

    // View the report — navigates to backtest page
    act(() => result.current.handleViewReport(jobWithReport!));
    expect(result.current.state.activePage).toBe('backtest');
    expect(result.current.activeReport).toBeDefined();
    expect(result.current.activeReport?.strategyName).toBeTruthy();
    expect(result.current.activeReport?.metrics.length).toBeGreaterThan(0);
  });

  it('complete flow in Chinese', () => {
    const { result } = renderHook(() => useResearchWorkflow('zh'));

    act(() => result.current.handleRunResearch());
    expect(result.current.localizedJobs[0].state).toBe('已完成');

    const jobWithReport = result.current.localizedJobs.find((job) =>
      result.current.reportJobIds.includes(job.id),
    );
    expect(jobWithReport).toBeDefined();

    act(() => result.current.handleViewReport(jobWithReport!));
    expect(result.current.activeReport).toBeDefined();
  });

  it('mode switching preserves workspace navigation', () => {
    const { result } = renderHook(() => useResearchWorkflow('en'));

    // Switch to AI mode
    act(() => result.current.setActiveMode('ai'));
    expect(result.current.researchMode.id).toBe('ai');

    // Navigate to workspace
    act(() => result.current.handleNavClick('workspace'));
    expect(result.current.state.activePage).toBe('workspace');

    // Run research in AI mode
    act(() => result.current.handleRunResearch());
    const job = result.current.localizedJobs[0];
    expect(job.kind).toContain('AI');
  });
});
