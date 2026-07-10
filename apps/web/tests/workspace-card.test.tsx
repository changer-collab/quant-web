import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WorkspacePage } from '../src/components/workspace-page';
import { getUiCopy } from '../src/appData';
import type { StrategyRow } from '../src/appData';

vi.mock('../src/api/client', () => ({ apiPost: vi.fn().mockResolvedValue({ id: 't', status: 'pending' }) }));
vi.mock('../src/api/diagnostics', () => ({ fetchDiagnostic: vi.fn().mockResolvedValue(null) }));
vi.mock('../src/api/strategies-config', () => ({
  fetchStrategyConfig: vi.fn().mockResolvedValue({
    persisted: true,
    configSnapshot: { strategy: 'dual_ma', params: { symbol: '000001', timeframe: '1h', initialCash: 2000000 } },
    config_json: { symbol: '000001', timeframe: '1h', initialCash: 2000000 },
    hash: 'h',
    updated_at: 1,
  }),
  saveStrategyConfig: vi.fn().mockResolvedValue({ ok: true, hash: 'h', updated_at: 1 }),
}));
vi.mock('../src/api/tasks', () => ({
  submitBacktest: vi.fn().mockResolvedValue({ id: 'bt', status: 'pending' }),
  streamTask: vi.fn(),
}));
vi.mock('../src/api/preview', () => ({
  fetchPreview: vi.fn().mockResolvedValue({
    bars: [],
    overlays: [],
    signals: [],
    fingerprint: 'sha256:test',
  }),
}));

const strategy: StrategyRow = {
  id: 'dual_ma',
  name: '双均线策略',
  type: 'Trend / CTA',
  return: '12.3%',
  drawdown: '-4.5%',
  sharpe: '1.8',
  status: 'active',
  mode: 'non_factor',
  subcategory: 'trend_cta',
  workflowReady: true,
};

describe('WorkspacePage 卡片化', () => {
  it('config tab 的 ConfigPanel 与 KlineChart 外层有 card 类', async () => {
    const ui = getUiCopy('zh');
    const { container } = render(
      <WorkspacePage strategy={strategy} ui={ui} language="zh" onBack={() => {}} />
    );
    await waitFor(() => {
      const cards = container.querySelectorAll('[class*="card"]');
      expect(cards.length).toBeGreaterThanOrEqual(2);
    });
  });
});
