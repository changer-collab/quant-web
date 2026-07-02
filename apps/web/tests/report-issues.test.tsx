import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ReportIssues } from '../src/components/report/ReportIssues';
import { createBacktestReportFull, getReportUiCopy } from '../src/appData';

function makeReport() {
  return createBacktestReportFull({
    issues: {
      overfittingRisk: 'medium',
      survivorshipBias: false,
      lookAheadBias: false,
      liquidityAssessment: '假设市场流动性充足；未考虑冲击成本；滑点恶化亏损；基于日线回测。',
      capacityEstimate: '容量受成交额约束；大资金需要分批建仓。',
    },
  });
}

describe('ReportIssues keyword tiles', () => {
  it('renders potential issues as status and keyword tiles', () => {
    const { container } = render(<ReportIssues report={makeReport()} ui={getReportUiCopy('zh')} />);

    expect(screen.getByText('假设市场流动性充足')).toBeInTheDocument();
    expect(screen.getByText('未考虑冲击成本')).toBeInTheDocument();
    expect(screen.getByText('滑点恶化亏损')).toBeInTheDocument();
    expect(screen.getByText('基于日线回测')).toBeInTheDocument();
    expect(screen.getByText('容量受成交额约束')).toBeInTheDocument();
    expect(screen.getByText('大资金需要分批建仓')).toBeInTheDocument();

    expect(container.querySelectorAll('[data-keyword-tile="true"]').length).toBeGreaterThanOrEqual(
      6
    );
    expect(container.querySelector('[data-testid="liquidity-assessment-paragraph"]')).toBeNull();
  });
});
