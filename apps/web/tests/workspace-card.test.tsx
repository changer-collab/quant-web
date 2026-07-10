import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { WorkspacePage } from '../src/components/workspace-page';
import { getUiCopy } from '../src/appData';
import type { StrategyRow } from '../src/appData';
import { fetchDiagnostic } from '../src/api/diagnostics';

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

  it('诊断 tab 的 chartCard 有标题与 cardBody 包裹', async () => {
    // 注入 factor_based 诊断结果，使诊断 tab 渲染 chartCardTitle/chartCard 结构。
    // brief 原测试断言 [class*="cardHeader"] 匹配 chartCardTitle，依赖 CSS modules
    // composes 在运行时合并类名；但 vitest/jsdom 环境下 composes 不解析（CSS module
    // 导出 chartCardTitle 仅含 _chartCardTitle_hash，不含 _cardHeader_hash），故改测
    // 可观测的结构：chartCardTitle 标题渲染 + cardBody 内容包裹（Step 4）。
    // composes: cardHeader（Step 3）由生产 build 解析，见构建产物校验。
    window.history.replaceState({}, '', '?diagnosticId=test');
    vi.mocked(fetchDiagnostic).mockResolvedValueOnce({
      resultId: 'test',
      resultType: 'diagnostics',
      taskId: 't',
      strategy: 'dual_ma',
      category: 'factor',
      subcategory: null,
      configSnapshot: { strategy: 'dual_ma', params: {} },
      data: {
        type: 'factor_based',
        ic_series: [],
        layered_returns: {},
        correlation_matrix: [],
        factor_labels: [],
        summary: {},
      },
      createdAt: 0,
      expiresAt: 0,
      engineVersion: 'test',
    });
    const ui = getUiCopy('zh');
    const { container } = render(
      <WorkspacePage strategy={strategy} ui={ui} language="zh" onBack={() => {}} />
    );
    // 切到 diagnose tab
    const diagTab = screen.getByRole('button', { name: ui.workspaceTabDiagnose });
    await act(async () => { fireEvent.click(diagTab); });
    await waitFor(() => {
      const titles = container.querySelectorAll('[class*="chartCardTitle"]');
      expect(titles.length).toBeGreaterThanOrEqual(1);
      const bodies = container.querySelectorAll('[class*="cardBody"]');
      expect(bodies.length).toBeGreaterThanOrEqual(1);
    });
    window.history.replaceState({}, '', window.location.pathname);
  });
});
