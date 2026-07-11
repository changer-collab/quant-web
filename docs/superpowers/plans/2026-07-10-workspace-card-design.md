# Workspace 卡片化与视觉分隔 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Workspace 页面所有可视化块（K 线、诊断图、回测图、Config 面板）统一添加实体卡片包装与阴影层次分隔。

**Architecture:** 纯 CSS module + className 调整，不抽 React 组件（YAGNI）。在 `workspace-page.module.css` 建立统一 `.card`/`.cardHeader`/`.cardBody`/`.cardTitle` 样式系统，config tab 两栏与诊断 tab 所有图复用。复用项目现有 `--gradient-panel`/`--shadow-md`/`--radius-lg` token，不新增设计变量。

**Tech Stack:** React + TypeScript + CSS Modules + Vitest + @testing-library/react + Playwright

## Global Constraints

- 所有回复使用中文。
- 遵循 KISS 原则，不引入过早抽象（不抽 `<Card>` 组件）。
- 复用现有设计 token（`--gradient-panel`/`--shadow-md`/`--radius-lg`/`--line`），不新增 token。
- 不改动 K 线绘制逻辑、信号映射、数据流。
- 不改动 dashboard / strategy-center 等其他页面，聚焦 workspace。
- 开发分支为 `changer`；按项目规则，commit 需用户明确确认后才执行。
- 验证命令：`pnpm --filter @quant/web build` 与 `pnpm --filter @quant/web test`。
- 测试模式：vitest + @testing-library/react，用 `container.querySelector` + `className.toContain(/xxx/)` 断言 CSS module 类名（CSS module 在测试环境中类名可部分匹配，参见 `tests/metric-card.test.tsx`）。

## File Structure

| 文件 | 职责 | 改动类型 |
|---|---|---|
| `apps/web/src/styles/workspace-page.module.css` | 统一卡片样式系统 + chartCard 升级 + MiniGrid 指标卡片化 + perfCard 统一 | Modify |
| `apps/web/src/styles/kline-chart.module.css` | K 线容器去背景 + signalBar padding | Modify |
| `apps/web/src/styles/config-panel.module.css` | section 嵌套子卡片 | Modify |
| `apps/web/src/components/workspace-page.tsx` | config tab 包卡片 + 诊断调用点更新 + backtest 区块卡片化 | Modify |
| `apps/web/src/components/kline-chart.tsx` | 顶层容器适配（去背景由 CSS 处理，确认 JSX 无需改） | Verify |
| `apps/web/src/components/config-panel.tsx` | 确认 section className 无需改（CSS 升级即可） | Verify |
| `apps/web/tests/workspace-card.test.tsx` | 卡片 className 断言测试 | Create |

---

### Task 1: 统一卡片样式系统 + config tab 卡片包装

**Files:**
- Modify: `apps/web/src/styles/workspace-page.module.css`（新增 `.card`/`.cardHeader`/`.cardBody`/`.cardTitle`，放在 `/* ── Chart Card ── */` 段之前）
- Modify: `apps/web/src/components/workspace-page.tsx:1027-1052`（config tab 两栏包卡片）
- Create: `apps/web/tests/workspace-card.test.tsx`

**Interfaces:**
- Produces: CSS 类 `.card`/`.cardHeader`/`.cardBody`/`.cardTitle`（供 Task 3 诊断 tab 复用）；workspace-page.tsx config tab JSX 结构变更（ConfigPanel 与 KlineChart 外层包 `.card`）

- [ ] **Step 1: 写失败测试 — config tab 渲染卡片包装**

创建 `apps/web/tests/workspace-card.test.tsx`：

```tsx
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @quant/web test -- workspace-card`
Expected: FAIL — `cards.length >= 2` 不满足（当前 config tab 无 card 类）

- [ ] **Step 3: 新增统一卡片 CSS 类**

在 `apps/web/src/styles/workspace-page.module.css` 的 `/* ── Chart Card ── */` 注释行之前插入：

```css
/* ── Unified Card ── */
.card {
  background: var(--gradient-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
}
.cardHeader {
  padding: 12px 16px;
  border-bottom: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
}
.cardTitle {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--green);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cardBody {
  padding: 16px;
  flex: 1;
  min-height: 0;
}

```

- [ ] **Step 4: config tab 两栏包卡片**

修改 `apps/web/src/components/workspace-page.tsx`，将 config tab 的两栏（约 1027-1052 行）从：

```tsx
{activeTab === 'config' && (
  <div className={s.configTabLayout}>
    <div className={s.configPanelWrapper}>
      <ConfigPanel
        strategy={strategy}
        ui={ui}
        language={language}
        onPreviewUpdate={handlePreviewUpdate}
        onConfigSaved={handleConfigSaved}
        klineSymbol={klineSymbol}
      />
    </div>
    <div className={s.klinePanelWrapper}>
      <KlineChart
        previewData={previewData}
        subcategory={strategy.subcategory}
        ui={ui}
        language={language}
        onSymbolChange={handleSymbolChange}
        onLoadMore={handleLoadMore}
        loading={klineLoading}
        error={klineError}
      />
    </div>
  </div>
)}
```

改为：

```tsx
{activeTab === 'config' && (
  <div className={s.configTabLayout}>
    <div className={s.configPanelWrapper}>
      <div className={s.card}>
        <div className={s.cardHeader}>
          <span className={s.cardTitle}>{ui.workspaceTabConfig}</span>
        </div>
        <div className={s.cardBody}>
          <ConfigPanel
            strategy={strategy}
            ui={ui}
            language={language}
            onPreviewUpdate={handlePreviewUpdate}
            onConfigSaved={handleConfigSaved}
            klineSymbol={klineSymbol}
          />
        </div>
      </div>
    </div>
    <div className={s.klinePanelWrapper}>
      <div className={s.card}>
        <KlineChart
          previewData={previewData}
          subcategory={strategy.subcategory}
          ui={ui}
          language={language}
          onSymbolChange={handleSymbolChange}
          onLoadMore={handleLoadMore}
          loading={klineLoading}
          error={klineError}
        />
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @quant/web test -- workspace-card`
Expected: PASS

- [ ] **Step 6: 运行全量测试确认无回归**

Run: `pnpm --filter @quant/web test`
Expected: 全部 PASS（原有 107 + 新增 1）

- [ ] **Step 7: 构建验证**

Run: `pnpm --filter @quant/web build`
Expected: 构建成功

- [ ] **Step 8: Commit（需用户确认）**

```bash
git add apps/web/src/styles/workspace-page.module.css apps/web/src/components/workspace-page.tsx apps/web/tests/workspace-card.test.tsx
git commit -m "feat(web): 统一卡片样式系统 + config tab 卡片包装"
```

---

### Task 2: K 线内部适配卡片

**Files:**
- Modify: `apps/web/src/styles/kline-chart.module.css:5-13`（`.klineContainer` 去背景）
- Modify: `apps/web/src/styles/kline-chart.module.css:287-297`（`.signalBar` padding 微调）
- Verify: `apps/web/src/components/kline-chart.tsx`（确认 JSX 无需改）

**Interfaces:**
- Consumes: Task 1 的 `.card` 包装（KlineChart 现在被 `.card` 包裹）
- Produces: K 线容器透明背景，由父卡片提供背景；signalBar padding 与 cardHeader 对齐

- [ ] **Step 1: 修改 `.klineContainer` 去背景**

在 `apps/web/src/styles/kline-chart.module.css`，将：

```css
.klineContainer {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  display: flex;
  flex-direction: column;
  background: rgba(6, 14, 13, 0.8);
}
```

改为：

```css
.klineContainer {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  display: flex;
  flex-direction: column;
}
```

- [ ] **Step 2: 修改 `.signalBar` padding**

同文件，将：

```css
.signalBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 12px;
  border-top: 1px solid var(--line);
  font-size: 10px;
  color: var(--muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
```

改为：

```css
.signalBar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  border-top: 1px solid var(--line);
  font-size: 10px;
  color: var(--muted);
  font-family: var(--font-mono);
  flex-shrink: 0;
}
```

- [ ] **Step 3: 确认 kline-chart.tsx 无需 JSX 改动**

Run: 用 Grep 确认 `apps/web/src/components/kline-chart.tsx` 顶层仍是 `<div className={s.klineContainer}>`，无内联 background 样式。
Expected: 仅 CSS module 类引用，无内联背景。

- [ ] **Step 4: 运行全量测试确认无回归**

Run: `pnpm --filter @quant/web test`
Expected: 全部 PASS

- [ ] **Step 5: 构建验证**

Run: `pnpm --filter @quant/web build`
Expected: 构建成功

- [ ] **Step 6: Commit（需用户确认）**

```bash
git add apps/web/src/styles/kline-chart.module.css
git commit -m "style(web): K 线容器去背景适配卡片 + signalBar padding 对齐"
```

---

### Task 3: 诊断 tab chartCard 升级

**Files:**
- Modify: `apps/web/src/styles/workspace-page.module.css:156-175`（升级 `.chartCard`/`.chartCardFull`/`.chartCardTitle`）
- Modify: `apps/web/src/components/workspace-page.tsx:710-781`（诊断调用点 `.chartCardTitle` → `.cardHeader`，内容包 `.cardBody`）
- Modify: `apps/web/tests/workspace-card.test.tsx`（新增诊断卡片断言）

**Interfaces:**
- Consumes: Task 1 的 `.cardHeader`/`.cardBody`/`.cardTitle` 类
- Produces: 诊断 tab 所有图有阴影层次 + 头部 border-bottom 分隔

- [ ] **Step 1: 写失败测试 — 诊断 tab chartCard 有 cardHeader**

在 `apps/web/tests/workspace-card.test.tsx` 的 describe block 内追加：

```tsx
  it('诊断 tab 的 chartCard 标题用 cardHeader 类', async () => {
    const ui = getUiCopy('zh');
    const { container } = render(
      <WorkspacePage strategy={strategy} ui={ui} language="zh" onBack={() => {}} />
    );
    // 切到 diagnose tab
    const diagTab = screen.getByRole('button', { name: ui.workspaceTabDiagnose });
    await act(async () => { fireEvent.click(diagTab); });
    await waitFor(() => {
      const headers = container.querySelectorAll('[class*="cardHeader"]');
      expect(headers.length).toBeGreaterThanOrEqual(1);
    });
  });
```

并在文件顶部 import 补充 `fireEvent, act`：

```tsx
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @quant/web test -- workspace-card`
Expected: FAIL — 诊断 tab 当前用 `chartCardTitle` 不是 `cardHeader`

- [ ] **Step 3: 升级 chartCard CSS**

在 `apps/web/src/styles/workspace-page.module.css`，将 `/* ── Chart Card ── */` 段：

```css
.chartCard {
  padding: 16px;
  background: var(--gradient-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  min-height: 200px;
}
.chartCardTitle {
  font-size: 13px;
  font-weight: 700;
  color: var(--green);
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.chartCardFull {
  composes: chartCard;
  grid-column: 1 / -1;
}
```

改为：

```css
.chartCard {
  background: var(--gradient-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 200px;
}
.chartCardTitle {
  composes: cardHeader;
}
.chartCardFull {
  composes: chartCard;
  grid-column: 1 / -1;
}
```

说明：`.chartCardTitle` 通过 `composes: cardHeader` 复用统一头部样式；`.chartCard` 去掉 `padding:16px`（由内部 `.cardBody` 提供），升级 radius/shadow/overflow。

- [ ] **Step 3b: MiniGrid 指标卡片化 — 每个指标独立小卡片**

同文件 `apps/web/src/styles/workspace-page.module.css`，将 MiniGrid 段：

```css
.miniGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  gap: 4px;
}
.miniGridCell {
  padding: 6px;
  background: rgba(77, 240, 160, 0.06);
  border: 1px solid var(--line);
  border-radius: var(--radius-xs);
  text-align: center;
}
.miniGridLabel {
  font-size: 9px;
  color: var(--muted);
  display: block;
}
.miniGridValue {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
}
```

改为：

```css
.miniGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 10px;
}
.miniGridCell {
  padding: 12px;
  background: var(--gradient-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.miniGridLabel {
  font-size: 11px;
  color: var(--muted);
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.miniGridValue {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
```

说明：列宽 60px→130px（每个指标有足够空间），gap 4px→10px，padding 6px→12px，字号 9px→11px / 12px→16px，加 shadow-sm 阴影，每个 miniGridCell 成为独立可读的指标小卡片。

- [ ] **Step 4: 诊断调用点内容包 cardBody**

修改 `apps/web/src/components/workspace-page.tsx` 第 710-781 行，每个 `.chartCard`/`.chartCardFull` 内的内容用 `<div className={s.cardBody}>` 包裹。

factor_based 段（711-735）改为：

```tsx
<div className={s.diagnosticGrid}>
  <div className={s.chartCard}>
    <div className={s.chartCardTitle}>{ui.workspaceICSeries}</div>
    <div className={s.cardBody}>
      {hasData ? <BarChart data={icData} /> : <div className={s.emptyState}>No IC data</div>}
    </div>
  </div>
  <div className={s.chartCard}>
    <div className={s.chartCardTitle}>{ui.workspaceLayeredReturns}</div>
    <div className={s.cardBody}>
      {layerData.length > 0 ? (
        <HBarChart data={layerData} />
      ) : (
        <div className={s.emptyState}>No layer data</div>
      )}
    </div>
  </div>
  <div className={s.chartCardFull}>
    <div className={s.chartCardTitle}>{ui.workspaceCorrelationHeatmap}</div>
    <div className={s.cardBody}>
      {corrMatrix.length > 0 && factorLabels.length > 0 ? (
        <HeatmapChart grid={corrMatrix} rowLabels={factorLabels} colLabels={factorLabels} />
      ) : (
        <div className={s.emptyState}>No correlation data</div>
      )}
    </div>
  </div>
  <div className={s.chartCardFull}>
    <div className={s.cardBody}>
      <MiniGrid items={summaryItems} />
    </div>
  </div>
</div>
```

non_factor 段（744-772）改为：

```tsx
<div className={s.diagnosticGrid}>
  <div className={s.chartCardFull}>
    <div className={s.chartCardTitle}>{ui.workspaceParamSensitivity}</div>
    <div className={s.cardBody}>
      {hasSens ? (
        <HeatmapChart grid={sensSharpeGrid} rowLabels={sensLabels} colLabels={sensLabels} />
      ) : (
        <div className={s.emptyState}>No param sensitivity data</div>
      )}
    </div>
  </div>
  <div className={s.chartCard}>
    <div className={s.chartCardTitle}>{ui.workspaceSignalDist}</div>
    <div className={s.cardBody}>
      <MiniGrid items={signalItems} />
    </div>
  </div>
  <div className={s.chartCard}>
    <div className={s.chartCardTitle}>{ui.workspaceSlippageStress}</div>
    <div className={s.cardBody}>
      {slippageReturns.length > 0 ? (
        <LineChart points={slippageReturns} color="#ffa94d" />
      ) : (
        <div className={s.emptyState}>No slippage data</div>
      )}
      {costItems.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <MiniGrid items={costItems} />
        </div>
      )}
    </div>
  </div>
</div>
```

fallback 段（776-781）改为：

```tsx
<div className={s.chartCardFull}>
  <div className={s.chartCardTitle}>{ui.workspaceSignalMetrics}</div>
  <div className={s.cardBody}>
    <div className={s.emptyState}>Diagnostics data available</div>
  </div>
</div>
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @quant/web test -- workspace-card`
Expected: PASS（两个测试均通过）

- [ ] **Step 6: 运行全量测试确认无回归**

Run: `pnpm --filter @quant/web test`
Expected: 全部 PASS

- [ ] **Step 7: 构建验证**

Run: `pnpm --filter @quant/web build`
Expected: 构建成功

- [ ] **Step 8: Commit（需用户确认）**

```bash
git add apps/web/src/styles/workspace-page.module.css apps/web/src/components/workspace-page.tsx apps/web/tests/workspace-card.test.tsx
git commit -m "feat(web): 诊断 tab chartCard 升级阴影层次 + 头部分隔"
```

---

### Task 4: ConfigPanel section 嵌套子卡片

**Files:**
- Modify: `apps/web/src/styles/config-panel.module.css:97-99`（`.section` 升级）
- Verify: `apps/web/src/components/config-panel.tsx`（确认 section className 无需改）

**Interfaces:**
- Produces: ConfigPanel 内 section 有嵌套卡片视觉（比父卡片圆角小一级，形成层次）

- [ ] **Step 1: 升级 `.section` CSS**

在 `apps/web/src/styles/config-panel.module.css`，将：

```css
.section {
  margin-bottom: 20px;
}
```

改为：

```css
.section {
  margin-bottom: 14px;
  padding: 12px;
  background: rgba(8, 16, 15, 0.4);
  border: 1px solid rgba(38, 54, 50, 0.5);
  border-radius: var(--radius-md);
}
```

- [ ] **Step 2: 确认 config-panel.tsx 无需 className 改动**

Run: Grep 确认 `apps/web/src/components/config-panel.tsx` 中 `.section` 类引用不变。
Expected: JSX 仍用 `className={s.section}`，无需改动。

- [ ] **Step 3: 运行全量测试确认无回归**

Run: `pnpm --filter @quant/web test`
Expected: 全部 PASS

- [ ] **Step 4: 构建验证**

Run: `pnpm --filter @quant/web build`
Expected: 构建成功

- [ ] **Step 5: Commit（需用户确认）**

```bash
git add apps/web/src/styles/config-panel.module.css
git commit -m "style(web): ConfigPanel section 嵌套子卡片层次"
```

---

### Task 5: backtest tab 区块卡片化 + perfCard 统一

**Files:**
- Modify: `apps/web/src/styles/workspace-page.module.css:353-381`（`.perfGrid`/`.perfCard` 统一风格）
- Modify: `apps/web/src/components/workspace-page.tsx:896-960`（perfGrid/equityCurve/tradeTable 各包 `.card`）

**Interfaces:**
- Consumes: Task 1 的 `.card`/`.cardHeader`/`.cardBody` 类
- Produces: backtest tab 每个区块（性能指标、资金曲线、交易明细）独立卡片；perfCard 与统一卡片风格一致

- [ ] **Step 1: 升级 perfCard 统一风格**

在 `apps/web/src/styles/workspace-page.module.css`，将 perfGrid 段：

```css
.perfGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.perfCard {
  padding: 14px;
  background: var(--gradient-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  text-align: center;
}
```

改为：

```css
.perfGrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.perfCard {
  padding: 16px;
  background: var(--gradient-panel);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
```

说明：perfCard radius-sm→radius-lg，加 shadow-md，与新 `.card` 一致；perfGrid 去掉 margin-bottom（由卡片间 gap 管理）。

- [ ] **Step 2: backtest 区块包卡片**

修改 `apps/web/src/components/workspace-page.tsx` 第 896-960 行。将 Performance metrics 段：

```tsx
<div className={s.chartCardTitle}>{ui.workspacePerformanceTitle}</div>
<div className={s.perfGrid}>
  <div className={s.perfCard}>
    ...
  </div>
  <div className={s.perfCard}>
    ...
  </div>
  <div className={s.perfCard}>
    ...
  </div>
</div>
```

改为：

```tsx
<div className={s.card}>
  <div className={s.cardHeader}>
    <span className={s.cardTitle}>{ui.workspacePerformanceTitle}</span>
  </div>
  <div className={s.cardBody}>
    <div className={s.perfGrid}>
      <div className={s.perfCard}>
        <div className={`${s.perfCardValue} ${(metrics?.totalReturn ?? 0) > 0 ? s.perfCardGood : s.perfCardWarn}`}>
          {formatPercent(metrics?.totalReturn)}
        </div>
        <div className={s.perfCardLabel}>
          {language === 'zh' ? '总收益' : 'Total Return'}
        </div>
      </div>
      <div className={s.perfCard}>
        <div className={`${s.perfCardValue} ${s.perfCardWarn}`}>
          {formatPercent(metrics?.maxDrawdown)}
        </div>
        <div className={s.perfCardLabel}>
          {language === 'zh' ? '最大回撤' : 'Max Drawdown'}
        </div>
      </div>
      <div className={s.perfCard}>
        <div className={`${s.perfCardValue} ${(metrics?.sharpeRatio ?? 0) > 1 ? s.perfCardGood : s.perfCardWarn}`}>
          {formatNumber(metrics?.sharpeRatio)}
        </div>
        <div className={s.perfCardLabel}>
          {language === 'zh' ? '夏普比率' : 'Sharpe Ratio'}
        </div>
      </div>
    </div>
  </div>
</div>
```

Equity Curve 段：

```tsx
<div className={s.chartCardTitle}>{ui.workspaceEquityCurve}</div>
<div className={s.equityCurve}>
  <LineChart points={equityPoints} />
</div>
```

改为：

```tsx
<div className={s.card}>
  <div className={s.cardHeader}>
    <span className={s.cardTitle}>{ui.workspaceEquityCurve}</span>
  </div>
  <div className={s.cardBody}>
    <div className={s.equityCurve}>
      <LineChart points={equityPoints} />
    </div>
  </div>
</div>
```

Trade Details 段：

```tsx
<div className={s.chartCardTitle}>{ui.workspaceTradeDetails}</div>
<div style={{ overflowX: 'auto' }}>
  <table className={s.tradeTable}>
    ...
  </table>
</div>
```

改为：

```tsx
<div className={s.card}>
  <div className={s.cardHeader}>
    <span className={s.cardTitle}>{ui.workspaceTradeDetails}</span>
  </div>
  <div className={s.cardBody}>
    <div style={{ overflowX: 'auto' }}>
      <table className={s.tradeTable}>
        ...
      </table>
    </div>
  </div>
</div>
```

- [ ] **Step 3: 运行全量测试确认无回归**

Run: `pnpm --filter @quant/web test`
Expected: 全部 PASS

- [ ] **Step 4: 构建验证**

Run: `pnpm --filter @quant/web build`
Expected: 构建成功

- [ ] **Step 5: Commit（需用户确认）**

```bash
git add apps/web/src/styles/workspace-page.module.css apps/web/src/components/workspace-page.tsx
git commit -m "feat(web): backtest tab 区块卡片化 + perfCard 统一阴影风格"
```

---

### Task 6: 全量验证 + Playwright 视觉确认

**Files:**
- Verify: 全 workspace 视觉效果

**Interfaces:**
- Consumes: Task 1-4 全部改动

- [ ] **Step 1: 全量构建**

Run: `pnpm --filter @quant/web build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 2: 全量测试**

Run: `pnpm --filter @quant/web test`
Expected: 全部 PASS（原有 107 + 新增 2 = 109）

- [ ] **Step 3: Playwright 视觉验证 — config tab**

通过 Playwright MCP：
1. `browser_navigate` → `http://127.0.0.1:4174/`
2. `browser_click` → "Strategy Center"
3. `browser_click` → "双均线策略" 进入 workspace
4. `browser_console_messages` → Expected: 0 errors, 0 warnings
5. `browser_snapshot` → Expected: Config 面板与 K 线各有卡片边框（.card），K 线有阴影层次，ConfigPanel 内 section 有嵌套背景

- [ ] **Step 4: Playwright 视觉验证 — diagnose tab**

1. `browser_click` → "Diagnose" tab
2. `browser_click` → 运行诊断（如需配置先在 config tab 保存）
3. `browser_snapshot` → Expected: 诊断图有阴影层次，标题栏与内容区有 border-bottom 分隔，圆角 8px 一致
4. `browser_console_messages` → Expected: 0 errors

- [ ] **Step 5: 视觉检查清单**

确认以下视觉点：
- [ ] config tab：ConfigPanel 与 KlineChart 均有卡片包装（边框 + 圆角 + 阴影）
- [ ] K 线卡片：toolbar 作为头部（border-bottom），chartWrapper 主体，signalBar 底栏（border-top），无双重背景
- [ ] 诊断 tab：所有 chartCard 有 shadow-md 阴影，chartCardTitle 作为头部有 border-bottom 分隔
- [ ] 诊断 MiniGrid：每个 miniGridCell 是独立小卡片（130px 宽、12px padding、16px 字号、shadow-sm），指标清晰可读不挤
- [ ] backtest tab：Performance / Equity Curve / Trade Details 各自独立 .card 卡片，有头部标题与内容区分隔
- [ ] backtest perfCard：3 个性能指标卡有 shadow-md + radius-lg，与统一卡片风格一致
- [ ] ConfigPanel 内 section 有嵌套背景（rgba(8,16,15,0.4)）与圆角，比父卡片小一级
- [ ] 圆角统一 8px（--radius-lg），perfCard/miniGridCell 用 radius-md/lg 层次

- [ ] **Step 6: 报告完成**

向用户报告：改动文件、验证结果（build/test/Playwright）、视觉检查清单完成情况。

---

## Self-Review

**1. Spec coverage:**
- 统一卡片规范 → Task 1 Step 3 ✓
- config tab 两栏卡片 → Task 1 Step 4 ✓
- K 线内部适配（去背景、signalBar padding）→ Task 2 ✓
- 诊断 tab chartCard 升级（radius/shadow/overflow、头部 border-bottom、内容 cardBody）→ Task 3 ✓
- ConfigPanel section 嵌套卡片 → Task 4 ✓
- 间距与响应式 → 复用现有 gap 16px，configTabLayout 已有 1024px 回退，无需改动 ✓
- 验证（build/test/Playwright）→ Task 5 ✓

**2. Placeholder scan:** 无 TBD/TODO，所有步骤含完整代码或精确命令。✓

**3. Type consistency:** `.card`/`.cardHeader`/`.cardBody`/`.cardTitle` 在 Task 1 定义，Task 3 通过 `composes: cardHeader` 复用，类名一致。测试文件 Task 1 创建、Task 3 追加，import 一致。✓
