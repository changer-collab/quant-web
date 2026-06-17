import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../src/components/common';
import type { Metric } from '../src/appData';

describe('MetricCard', () => {
  it('renders label and value', () => {
    const metric: Metric = { label: 'Sharpe', value: '2.18', tone: 'good' };
    render(<MetricCard metric={metric} />);
    expect(screen.getByText('Sharpe')).toBeInTheDocument();
    expect(screen.getByText('2.18')).toBeInTheDocument();
  });

  it('applies good tone class for positive metrics', () => {
    const metric: Metric = { label: 'Return', value: '+34%', tone: 'good' };
    const { container } = render(<MetricCard metric={metric} />);
    const article = container.querySelector('article');
    expect(article?.className).toContain('metricGood');
  });

  it('applies warn tone class for warning metrics', () => {
    const metric: Metric = { label: 'Drawdown', value: '-9%', tone: 'warn' };
    const { container } = render(<MetricCard metric={metric} />);
    const article = container.querySelector('article');
    expect(article?.className).toContain('metricWarn');
  });

  it('applies info tone class for informational metrics', () => {
    const metric: Metric = { label: 'Mode', value: 'AI', tone: 'info' };
    const { container } = render(<MetricCard metric={metric} />);
    const article = container.querySelector('article');
    expect(article?.className).toContain('metricInfo');
  });
});
