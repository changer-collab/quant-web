import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobList } from '../src/components/jobs';
import type { ResearchJob } from '../src/appData';
import { getUiCopy, getJobs } from '../src/appData';

const ui = getUiCopy('en');
const mockJobs = getJobs('en');

describe('JobList', () => {
  it('renders job names and states', () => {
    render(<JobList jobs={mockJobs} ui={ui} />);
    expect(screen.getByText(mockJobs[0].name)).toBeInTheDocument();
    // Multiple jobs may share the same state, use getAllByText
    const stateElements = screen.getAllByText(mockJobs[0].state);
    expect(stateElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders progress bars', () => {
    const { container } = render(<JobList jobs={mockJobs} ui={ui} />);
    const progressBars = container.querySelectorAll('[class*="progressBar"]');
    expect(progressBars.length).toBe(mockJobs.length);
  });

  it('shows view report button only for jobs with reports', () => {
    const reportJobIds = [mockJobs[0].id];
    const onViewReport = vi.fn();
    render(<JobList jobs={mockJobs} onViewReport={onViewReport} reportJobIds={reportJobIds} ui={ui} />);
    expect(screen.getByText(ui.viewReport)).toBeInTheDocument();
  });

  it('does not show view report button when no ui is provided', () => {
    render(<JobList jobs={mockJobs} />);
    expect(screen.queryByText(ui.viewReport)).not.toBeInTheDocument();
  });

  it('calls onViewReport when button is clicked', () => {
    const reportJobIds = [mockJobs[0].id];
    const onViewReport = vi.fn();
    render(<JobList jobs={mockJobs} onViewReport={onViewReport} reportJobIds={reportJobIds} ui={ui} />);
    fireEvent.click(screen.getByText(ui.viewReport));
    expect(onViewReport).toHaveBeenCalledWith(expect.objectContaining({ id: mockJobs[0].id }));
  });

  it('renders config summary chips when present', () => {
    const jobWithConfig: ResearchJob = {
      ...mockJobs[0],
      configSummary: ['Factor: quality', 'Universe: CSI 500'],
    };
    render(<JobList jobs={[jobWithConfig]} ui={ui} />);
    expect(screen.getByText('Factor: quality')).toBeInTheDocument();
    expect(screen.getByText('Universe: CSI 500')).toBeInTheDocument();
  });
});
