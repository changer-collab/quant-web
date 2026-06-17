import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReportSummary } from '../src/components/report';
import { createResearchReport, getStrategies, getUiCopy } from '../src/appData';

const ui = getUiCopy('en');
// 使用 Order Flow Momentum 策略（hft 模式，return +34.6%, sharpe 2.18）
const strategy = getStrategies('en').find((s) => s.id === 'strategy-hft-l2')!;

const report = createResearchReport(
  {
    id: 'report-test',
    jobId: 'job-test',
    sequence: 1,
    strategy,
    generatedAt: '14:30:00',
  },
  'en',
);

describe('ReportSummary', () => {
  it('renders report title', () => {
    render(<ReportSummary report={report} ui={ui} />);
    expect(screen.getByText(report.title)).toBeInTheDocument();
  });

  it('renders strategy name and mode', () => {
    render(<ReportSummary report={report} ui={ui} />);
    expect(screen.getByText(report.strategyName)).toBeInTheDocument();
    // modeName appears in both metrics and meta, use getAllByText
    const modeElements = screen.getAllByText(report.modeName);
    expect(modeElements.length).toBeGreaterThanOrEqual(1);
  });

  it('renders generated time', () => {
    render(<ReportSummary report={report} ui={ui} />);
    expect(screen.getByText(report.generatedAt)).toBeInTheDocument();
  });

  it('renders report status', () => {
    render(<ReportSummary report={report} ui={ui} />);
    expect(screen.getByText(report.status)).toBeInTheDocument();
  });

  it('renders metric values from the report', () => {
    render(<ReportSummary report={report} ui={ui} />);
    expect(screen.getByText('+34.6%')).toBeInTheDocument();
    expect(screen.getByText('2.18')).toBeInTheDocument();
  });
});
