# 前端策略总览与研究台重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 K线图崩溃、删除策略总览 config 中间页、研究台重构为三 Tab 架构，消除参数配置重复。

**Architecture:** K线图采用双 canvas 分层（基础层 + 信号叠加层）+ ref 解耦 hoveredSignal，切断鼠标移动触发的重绘循环。策略总览点击卡片直接进入研究台。研究台由 Stepper 改为三 Tab（参数配置+K线预览 / 诊断 / 回测），ConfigPanel 移入 Tab 1，回测表单只保留运行参数。

**Tech Stack:** React 18 + TypeScript + Vite + Canvas 2D API + vitest + @testing-library/react

## Global Constraints

- 所有改动限于 `apps/web/src`，不触碰后端/数据中心/其他包
- 不引入路由库、状态库、新依赖（仍是 state 导航 + useState/useRef）
- 不使用 mock data，所有数据来自真实 API
- 新增 UI 文案必须进入 `src/data/zh.ts` 和 `src/data/en.ts`（或 UiCopy）
- 修改后必须运行：`npm test`、`npm run build`、`npm list --depth=0`
- 本地分支 `ralph/backend-sync-realign-phase6-9`，提交到此分支
- `MAX_BARS = 1500`（覆盖六年日线）
- `WorkspaceTab` 类型定义在 workspace-page.tsx 内（纯前端 UI 状态）

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `src/components/kline-chart-utils.ts` | 新建 | K线图纯函数：normalizeBars/computeLayout/downsample/maxByReduce |
| `src/components/kline-chart.tsx` | 重写 | 双 canvas 分层组件，引用 kline-chart-utils |
| `src/styles/kline-chart.module.css` | 修改 | 双 canvas 叠加定位 |
| `src/components/strategy-page.tsx` | 瘦身 | 删除 config 视图，只渲染 grid |
| `src/components/strategy-grid-new.tsx` | 修改 | 整卡可点击，移除"进入工作台"按钮 |
| `src/components/config-panel.tsx` | 修改 | 新增 onConfigSaved 回调 |
| `src/components/workspace-page.tsx` | 重写 | Stepper → 三 Tab，吸收 ConfigPanel + KlineChart |
| `src/styles/workspace-page.module.css` | 修改 | Tab 导航样式 |
| `tests/kline-chart-utils.test.ts` | 新建 | 纯函数单测 |
| `tests/strategy-page.test.tsx` | 新建 | 策略总览交互测试 |
| `tests/workspace-page.test.tsx` | 修改 | 三 Tab 交互测试 |

---

### Task 1: K线图纯函数抽取与单测

**Files:**
- Create: `apps/web/src/components/kline-chart-utils.ts`
- Test: `apps/web/tests/kline-chart-utils.test.ts`

**Interfaces:**
- Produces: `normalizeBars`, `computeLayout`, `downsample`, `maxByReduce` — 纯函数，无 React 依赖，供 Task 2 的 kline-chart.tsx 引用

- [ ] **Step 1: 写失败测试**

创建 `apps/web/tests/kline-chart-utils.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { normalizeBars, computeLayout, downsample, maxByReduce } from '../src/components/kline-chart-utils';

describe('normalizeBars', () => {
  it('returns empty array for empty input', () => {
    expect(normalizeBars([])).toEqual([]);
  });

  it('normalizes new format (ts/o/h/l/c/v)', () => {
    const bars = [{ ts: 1, o: 10, h: 11, l: 9, c: 10.5, v: 100 }];
    const result = normalizeBars(bars as any);
    expect(result).toEqual([{ ts: 1, o: 10, h: 11, l: 9, c: 10.5, v: 100 }]);
  });

  it('normalizes old format (timestamp/open/high/low/close/volume)', () => {
    const bars = [{ timestamp: 1, open: 10, high: 11, low: 9, close: 10.5, volume: 100 }];
    const result = normalizeBars(bars as any);
    expect(result).toEqual([{ ts: 1, o: 10, h: 11, l: 9, c: 10.5, v: 100 }]);
  });
});

describe('computeLayout', () => {
  it('computes layout with subchart', () => {
    const layout = computeLayout(600, 400, 100, true);
    expect(layout.main.w).toBe(600 - 54 - 10);
    expect(layout.main.h).toBeGreaterThan(0);
    expect(layout.volume.h).toBe(50);
    expect(layout.sub.h).toBe(50);
    expect(layout.barWidth).toBeGreaterThan(0);
  });

  it('computes layout without subchart', () => {
    const layout = computeLayout(600, 400, 100, false);
    expect(layout.sub.h).toBe(0);
    expect(layout.sub.w).toBe(0);
  });

  it('enforces min bar width', () => {
    const layout = computeLayout(100, 400, 1000, true);
    expect(layout.barWidth).toBeGreaterThanOrEqual(3);
  });
});

describe('downsample', () => {
  it('returns original array when under maxCount', () => {
    const arr = [1, 2, 3];
    expect(downsample(arr, 5)).toEqual([1, 2, 3]);
  });

  it('downsamples to maxCount when over', () => {
    const arr = Array.from({ length: 1501 }, (_, i) => i);
    const result = downsample(arr, 1500);
    expect(result.length).toBe(1500);
  });

  it('handles empty array', () => {
    expect(downsample([], 100)).toEqual([]);
  });

  it('handles single element', () => {
    expect(downsample([42], 100)).toEqual([42]);
  });
});

describe('maxByReduce', () => {
  it('returns 0 for empty array', () => {
    expect(maxByReduce([])).toBe(0);
  });

  it('returns max value', () => {
    expect(maxByReduce([1, 5, 3, 2])).toBe(5);
  });

  it('handles negative values', () => {
    expect(maxByReduce([-5, -1, -3])).toBe(-1);
  });

  it('handles large array without stack overflow', () => {
    const arr = Array.from({ length: 100000 }, (_, i) => i);
    expect(maxByReduce(arr)).toBe(99999);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd apps/web && npx vitest run tests/kline-chart-utils.test.ts`
Expected: FAIL — "Cannot find module '../src/components/kline-chart-utils'"

- [ ] **Step 3: 实现纯函数**

创建 `apps/web/src/components/kline-chart-utils.ts`：

```typescript
import type { BarData } from '../appData';

export interface NormalizedBar {
  ts: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface ChartLayout {
  main: { x: number; y: number; w: number; h: number };
  volume: { x: number; y: number; w: number; h: number };
  sub: { x: number; y: number; w: number; h: number };
  barWidth: number;
  visibleCount: number;
}

export const CHART_TOP = 36;
export const CHART_BOTTOM = 28;
export const CHART_LEFT = 54;
export const CHART_RIGHT = 10;
export const GAP_BETWEEN_CHARTS = 2;
export const MIN_BAR_WIDTH = 3;
export const CANDLE_WIDTH_RATIO = 0.6;

export function normalizeBars(bars: BarData[]): NormalizedBar[] {
  return bars.map((b) => {
    if ('ts' in (b as any)) {
      const nb = b as any;
      return { ts: nb.ts, o: nb.o, h: nb.h, l: nb.l, c: nb.c, v: nb.v };
    }
    return {
      ts: (b as any).timestamp,
      o: (b as any).open,
      h: (b as any).high,
      l: (b as any).low,
      c: (b as any).close,
      v: (b as any).volume,
    };
  });
}

export function computeLayout(
  cw: number,
  ch: number,
  barCount: number,
  hasSubChart: boolean
): ChartLayout {
  const volH = 50;
  const subH = hasSubChart ? 50 : 0;
  const mainH = ch - CHART_TOP - CHART_BOTTOM - volH - subH - GAP_BETWEEN_CHARTS * 2;
  const chartW = cw - CHART_LEFT - CHART_RIGHT;
  const barWidth = Math.max(MIN_BAR_WIDTH, chartW / Math.max(barCount, 1));
  const visibleCount = Math.floor(chartW / barWidth);

  return {
    main: { x: CHART_LEFT, y: CHART_TOP, w: chartW, h: mainH },
    volume: { x: CHART_LEFT, y: CHART_TOP + mainH + GAP_BETWEEN_CHARTS, w: chartW, h: volH },
    sub: hasSubChart
      ? { x: CHART_LEFT, y: CHART_TOP + mainH + volH + GAP_BETWEEN_CHARTS * 2, w: chartW, h: subH }
      : { x: 0, y: 0, w: 0, h: 0 },
    barWidth,
    visibleCount,
  };
}

export function downsample<T>(arr: T[], maxCount: number): T[] {
  if (arr.length <= maxCount) return arr;
  const step = arr.length / maxCount;
  const result: T[] = [];
  for (let i = 0; i < maxCount; i++) {
    result.push(arr[Math.floor(i * step)]);
  }
  return result;
}

export function maxByReduce(arr: number[]): number {
  return arr.reduce((m, v) => (v > m ? v : m), 0);
}
```

- [ ] **Step 4: 运行测试验证通过**

Run: `cd apps/web && npx vitest run tests/kline-chart-utils.test.ts`
Expected: PASS — 所有测试通过

- [ ] **Step 5: 提交**

```bash
cd apps/web
git add src/components/kline-chart-utils.ts tests/kline-chart-utils.test.ts
git commit -m "feat: 抽取 K线图纯函数 normalizeBars/computeLayout/downsample/maxByReduce + 单测"
```

---

### Task 2: K线图双 canvas 分层重写

**Files:**
- Modify: `apps/web/src/components/kline-chart.tsx`（完整重写）
- Modify: `apps/web/src/styles/kline-chart.module.css`
- Reference: `apps/web/src/components/kline-chart-utils.ts`（Task 1 产出）

**Interfaces:**
- Consumes: `normalizeBars`, `computeLayout`, `downsample`, `maxByReduce`, `CHART_*` 常量 from kline-chart-utils
- Produces: `KlineChart` 组件，Props 不变（`previewData / subcategory / ui / language / onSymbolChange / onLoadMore / loading`）

- [ ] **Step 1: 修改 CSS 支持双 canvas 叠加**

编辑 `apps/web/src/styles/kline-chart.module.css`，将 `.chartCanvas` 改为 `.baseCanvas` + `.overlayCanvas`：

找到：
```css
.chartCanvas {
  display: block;
  width: 100%;
  height: 100%;
}
```

替换为：
```css
.baseCanvas {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  z-index: 1;
}

.overlayCanvas {
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  z-index: 2;
  pointer-events: none;
}
```

- [ ] **Step 2: 重写 kline-chart.tsx 组件**

完整重写 `apps/web/src/components/kline-chart.tsx`。核心改动：
- 双 canvas（baseCanvasRef + overlayCanvasRef）
- `hoveredSignal` 改 ref，不触发重渲染
- `drawBase` 依赖 `[previewData, subcategory, ui]`
- `drawOverlay` 依赖 `[previewData]`
- ResizeObserver 防抖（requestAnimationFrame）
- 归一化数据缓存到 ref
- `Math.max(...arr)` 改 `maxByReduce`
- `MAX_BARS = 1500`，超过降采样

```typescript
import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  PreviewResponse,
  UiCopy,
  LanguageCode,
  BarData,
  ChartOverlay,
  PreviewSignal,
} from '../appData';
import {
  normalizeBars,
  computeLayout,
  downsample,
  maxByReduce,
  CHART_TOP,
  CHART_BOTTOM,
  CHART_LEFT,
  CHART_RIGHT,
  GAP_BETWEEN_CHARTS,
  CANDLE_WIDTH_RATIO,
  MIN_BAR_WIDTH,
  type NormalizedBar,
  type ChartLayout,
} from './kline-chart-utils';
import s from '../styles/kline-chart.module.css';

const MAX_BARS = 1500;

const MA_COLORS = ['#62d8ff', '#e9c46a', '#f472b6', '#a78bfa'];
const COLOR_UP = '#ef4444';
const COLOR_DOWN = '#22c55e';
const COLOR_GRID = 'rgba(98, 110, 110, 0.15)';
const COLOR_TEXT = 'rgba(150, 160, 160, 0.7)';
const COLOR_VOLUME_UP = 'rgba(239, 68, 68, 0.35)';
const COLOR_VOLUME_DOWN = 'rgba(34, 197, 94, 0.35)';

const OVERBOUGHT = 70;
const OVERSOLD = 30;
const DEFAULT_RSI_PERIOD = 14;
const FINGERPRINT_TOAST_DURATION = 3000;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function computeSMA(values: (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      out.push(null);
      continue;
    }
    let sum = 0;
    let cnt = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v != null && !Number.isNaN(v)) {
        sum += v;
        cnt++;
      }
    }
    out.push(cnt >= period * 0.5 ? sum / cnt : null);
  }
  return out;
}

function computeRSI(closes: number[], period: number): (number | null)[] {
  if (closes.length < period + 1) return closes.map(() => null);
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains.push(d > 0 ? d : 0);
    losses.push(d < 0 ? -d : 0);
  }
  const rsi: (number | null)[] = [null];
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  while (rsi.length < closes.length) rsi.push(null);
  return rsi;
}

function formatPrice(v: number): string {
  if (v >= 1000) return v.toFixed(2);
  if (v >= 10) return v.toFixed(2);
  if (v >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  priceMin: number,
  priceMax: number,
  barCount: number
) {
  const { main, volume } = layout;
  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 0.5;
  const priceSteps = 5;
  const areas = [main];
  if (volume.h > 0) areas.push(volume);
  for (const area of areas) {
    for (let i = 0; i <= priceSteps; i++) {
      const y = area.y + (area.h / priceSteps) * i;
      ctx.beginPath();
      ctx.moveTo(area.x, y);
      ctx.lineTo(area.x + area.w, y);
      ctx.stroke();
    }
  }
  const vStep = Math.max(1, Math.floor(barCount / 8));
  for (let i = 0; i < barCount; i += vStep) {
    const x = main.x + i * layout.barWidth;
    ctx.beginPath();
    ctx.moveTo(x, CHART_TOP);
    ctx.lineTo(
      x,
      CHART_TOP + main.h + volume.h + (layout.sub.h > 0 ? layout.sub.h + GAP_BETWEEN_CHARTS : 0)
    );
    ctx.stroke();
  }
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= priceSteps; i++) {
    const price = priceMax - ((priceMax - priceMin) / priceSteps) * i;
    const y = main.y + (main.h / priceSteps) * i;
    ctx.fillText(formatPrice(price), main.x - 4, y + 3);
  }
  ctx.textAlign = 'center';
  for (let i = 0; i < barCount; i += vStep) {
    const x = main.x + i * layout.barWidth + layout.barWidth / 2;
    ctx.fillText(
      `#${i + 1}`,
      x,
      CHART_TOP +
        main.h +
        volume.h +
        (layout.sub.h > 0 ? layout.sub.h + 14 : 14) +
        GAP_BETWEEN_CHARTS
    );
  }
}

function drawCandlesticks(
  ctx: CanvasRenderingContext2D,
  bars: NormalizedBar[],
  layout: ChartLayout,
  priceMin: number,
  priceMax: number
) {
  const { main, barWidth } = layout;
  const range = priceMax - priceMin || 1;
  const candleW = Math.max(2, barWidth * CANDLE_WIDTH_RATIO);
  const halfW = candleW / 2;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const x = main.x + i * barWidth + barWidth / 2;
    const isUp = b.c >= b.o;
    const color = isUp ? COLOR_UP : COLOR_DOWN;
    const openY = main.y + main.h - ((b.o - priceMin) / range) * main.h;
    const closeY = main.y + main.h - ((b.c - priceMin) / range) * main.h;
    const highY = main.y + main.h - ((b.h - priceMin) / range) * main.h;
    const lowY = main.y + main.h - ((b.l - priceMin) / range) * main.h;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();
    const bodyTop = Math.min(openY, closeY);
    const bodyBot = Math.max(openY, closeY);
    const bodyH = Math.max(1, bodyBot - bodyTop);
    ctx.fillStyle = color;
    ctx.fillRect(x - halfW, bodyTop, candleW, bodyH);
  }
}

function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: ChartOverlay[],
  layout: ChartLayout,
  priceMin: number,
  priceMax: number
) {
  const { main, barWidth } = layout;
  const range = priceMax - priceMin || 1;
  for (let oi = 0; oi < overlays.length; oi++) {
    const overlay = overlays[oi];
    const color = MA_COLORS[oi % MA_COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i < overlay.values.length; i++) {
      const v = overlay.values[i];
      if (v == null || Number.isNaN(v)) {
        started = false;
        continue;
      }
      const x = main.x + i * barWidth + barWidth / 2;
      const y = main.y + main.h - ((v - priceMin) / range) * main.h;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

function drawVolume(ctx: CanvasRenderingContext2D, bars: NormalizedBar[], layout: ChartLayout) {
  const { volume, barWidth } = layout;
  if (volume.h <= 0) return;
  const maxVol = maxByReduce(bars.map((b) => b.v)) || 1;
  const halfW = Math.max(1, (barWidth * CANDLE_WIDTH_RATIO) / 2);
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const isUp = b.c >= b.o;
    const h = (b.v / maxVol) * volume.h;
    ctx.fillStyle = isUp ? COLOR_VOLUME_UP : COLOR_VOLUME_DOWN;
    ctx.fillRect(
      volume.x + i * barWidth + barWidth / 2 - halfW,
      volume.y + volume.h - h,
      halfW * 2,
      h
    );
  }
}

function drawSubChart(
  ctx: CanvasRenderingContext2D,
  bars: NormalizedBar[],
  subcategory: string | null | undefined,
  layout: ChartLayout,
  subLabel: string
) {
  const { sub, barWidth } = layout;
  if (sub.h <= 0) return;
  const closes = bars.map((b) => b.c);
  const subcat = subcategory ?? '';
  let data: (number | null)[];
  let yMin = 0;
  let yMax = 100;
  if (subcat === 'trend_cta') {
    data = computeRSI(closes, DEFAULT_RSI_PERIOD);
    yMin = 0;
    yMax = 100;
  } else if (subcat === 'arbitrage' || subcat === 'hft_microstructure') {
    data = bars.map((b) => ((b.h - b.l) / b.c) * 100);
    yMin = 0;
    const vals = data.filter((d): d is number => d != null);
    yMax = vals.length > 0 ? maxByReduce(vals) * 1.2 : 10;
  } else if (subcat === 'macro_quant') {
    const returns = closes.map((c, i) => (i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1]));
    data = computeSMA(returns.map((r) => Math.abs(r) * 100), 10);
    const vals = data.filter((d): d is number => d != null);
    yMin = 0;
    yMax = vals.length > 0 ? maxByReduce(vals) * 1.2 : 5;
  } else if (
    subcat === 'e2e_ai_timeseries' ||
    subcat === 'factor_based' ||
    subcat === 'ml_nonlinear_factor' ||
    subcat === 'linear_multi_factor'
  ) {
    const base = closes[0] || 1;
    data = closes.map((c) => ((c - base) / base) * 100);
    const vals = data.filter((d): d is number => d != null);
    yMin = vals.length > 0 ? Math.min(...vals) * 1.2 : -5;
    yMax = vals.length > 0 ? maxByReduce(vals) * 1.2 : 5;
  } else if (subcat === 'event_driven' || subcat === 'transitional') {
    const avgVol = bars.reduce((s, b) => s + b.v, 0) / bars.length || 1;
    data = bars.map((b) => ((b.v - avgVol) / avgVol) * 100);
    const vals = data.filter((d): d is number => d != null);
    yMin = Math.min(...vals) * 1.2;
    yMax = maxByReduce(vals) * 1.2;
  } else {
    data = closes.map(() => 50);
    yMin = 0;
    yMax = 100;
  }
  const range = yMax - yMin || 1;
  if (subcat === 'trend_cta') {
    ctx.strokeStyle = 'rgba(233, 196, 106, 0.25)';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([3, 3]);
    for (const level of [OVERBOUGHT, OVERSOLD]) {
      const y = sub.y + sub.h - ((level - yMin) / range) * sub.h;
      ctx.beginPath();
      ctx.moveTo(sub.x, y);
      ctx.lineTo(sub.x + sub.w, y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(OVERBOUGHT), sub.x - 2, sub.y + sub.h - ((OVERBOUGHT - yMin) / range) * sub.h + 3);
    ctx.fillText(String(OVERSOLD), sub.x - 2, sub.y + sub.h - ((OVERSOLD - yMin) / range) * sub.h + 3);
  }
  ctx.strokeStyle = '#62d8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v == null || Number.isNaN(v)) {
      started = false;
      continue;
    }
    const x = sub.x + i * barWidth + barWidth / 2;
    const y = sub.y + sub.h - ((v - yMin) / range) * sub.h;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(subLabel, sub.x + 4, sub.y + 12);
}

function drawSignals(
  ctx: CanvasRenderingContext2D,
  signals: PreviewSignal[],
  bars: NormalizedBar[],
  layout: ChartLayout,
  priceMin: number,
  priceMax: number,
  hoveredSignal: number | null
) {
  const { main, barWidth } = layout;
  const range = priceMax - priceMin || 1;
  for (let si = 0; si < signals.length; si++) {
    const sig = signals[si];
    const idx = sig.bar_index;
    if (idx < 0 || idx >= bars.length) continue;
    const bar = bars[idx];
    const x = main.x + idx * barWidth + barWidth / 2;
    const isBuy = sig.side === 'buy';
    const color = isBuy ? COLOR_UP : COLOR_DOWN;
    const yBase = isBuy
      ? main.y + main.h - ((bar.l - priceMin) / range) * main.h - 4
      : main.y + main.h - ((bar.h - priceMin) / range) * main.h + 4;
    const isHovered = hoveredSignal === si;
    const size = isHovered ? 7 : 5;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (isBuy) {
      ctx.moveTo(x, yBase - size);
      ctx.lineTo(x - size, yBase);
      ctx.lineTo(x + size, yBase);
    } else {
      ctx.moveTo(x, yBase + size);
      ctx.lineTo(x - size, yBase);
      ctx.lineTo(x + size, yBase);
    }
    ctx.closePath();
    ctx.fill();
    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

export interface KlineChartProps {
  previewData: PreviewResponse | null;
  subcategory?: string | null;
  ui: UiCopy;
  language: LanguageCode;
  onSymbolChange?: (symbol: string) => void;
  onLoadMore?: (cursor: number) => void;
  loading?: boolean;
}

export function KlineChart({
  previewData,
  subcategory,
  ui,
  language,
  onSymbolChange,
  onLoadMore,
  loading = false,
}: KlineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevFingerprintRef = useRef<string | null>(null);
  const hoveredSignalRef = useRef<number | null>(null);
  const normalizedBarsRef = useRef<NormalizedBar[]>([]);
  const layoutRef = useRef<ChartLayout | null>(null);
  const priceRangeRef = useRef<{ min: number; max: number } | null>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const mouseRafRef = useRef<number | undefined>(undefined);

  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: NormalizedBar;
    signals: PreviewSignal[];
  } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastHiding, setToastHiding] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [downsampled, setDownsampled] = useState(false);

  // fingerprint 变更检测
  useEffect(() => {
    if (!previewData) return;
    const fp = previewData.fingerprint;
    if (prevFingerprintRef.current !== null && prevFingerprintRef.current !== fp) {
      setShowToast(true);
      setToastHiding(false);
      const hideTimer = setTimeout(() => {
        setToastHiding(true);
        setTimeout(() => setShowToast(false), 300);
      }, FINGERPRINT_TOAST_DURATION);
      return () => clearTimeout(hideTimer);
    }
    prevFingerprintRef.current = fp;
  }, [previewData]);

  // 归一化 + 降采样缓存
  useEffect(() => {
    if (!previewData || previewData.bars.length === 0) {
      normalizedBarsRef.current = [];
      setDownsampled(false);
      return;
    }
    const bars = normalizeBars(previewData.bars);
    if (bars.length > MAX_BARS) {
      normalizedBarsRef.current = downsample(bars, MAX_BARS);
      setDownsampled(true);
    } else {
      normalizedBarsRef.current = bars;
      setDownsampled(false);
    }
  }, [previewData]);

  // 基础层绘制
  const drawBase = useCallback(() => {
    const canvas = baseCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const bars = normalizedBarsRef.current;
    if (!previewData || bars.length === 0) return;

    const layout = computeLayout(w, h, bars.length, true);
    layoutRef.current = layout;

    let priceMin = Infinity;
    let priceMax = -Infinity;
    for (const b of bars) {
      if (b.l < priceMin) priceMin = b.l;
      if (b.h > priceMax) priceMax = b.h;
    }
    for (const ov of previewData.overlays) {
      for (const v of ov.values) {
        if (v != null && !Number.isNaN(v)) {
          if (v < priceMin) priceMin = v;
          if (v > priceMax) priceMax = v;
        }
      }
    }
    const pricePad = (priceMax - priceMin) * 0.05 || 1;
    priceMin -= pricePad;
    priceMax += pricePad;
    priceRangeRef.current = { min: priceMin, max: priceMax };

    drawGrid(ctx, layout, priceMin, priceMax, bars.length);
    drawVolume(ctx, bars, layout);
    drawCandlesticks(ctx, bars, layout, priceMin, priceMax);
    drawOverlays(ctx, previewData.overlays, layout, priceMin, priceMax);

    let subLabel = ui.klineChartRSI;
    if (subcategory && ['arbitrage', 'hft_microstructure'].includes(subcategory)) {
      subLabel = ui.klineChartSpread;
    } else if (
      subcategory &&
      ['factor_based', 'linear_multi_factor', 'ml_nonlinear_factor', 'e2e_ai_timeseries'].includes(subcategory)
    ) {
      subLabel = ui.klineChartIC;
    } else if (subcategory && ['transitional', 'event_driven'].includes(subcategory)) {
      subLabel = ui.klineChartSentiment;
    }
    drawSubChart(ctx, bars, subcategory, layout, subLabel);
  }, [previewData, subcategory, ui]);

  // 叠加层绘制（只画信号箭头）
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const bars = normalizedBarsRef.current;
    const layout = layoutRef.current;
    const priceRange = priceRangeRef.current;
    if (!previewData || bars.length === 0 || !layout || !priceRange) return;

    drawSignals(
      ctx,
      previewData.signals,
      bars,
      layout,
      priceRange.min,
      priceRange.max,
      hoveredSignalRef.current
    );
  }, [previewData]);

  // 基础层重绘 + ResizeObserver 防抖
  useEffect(() => {
    drawBase();
    drawOverlay();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        drawBase();
        drawOverlay();
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawBase, drawOverlay]);

  // 数据变化时重绘
  useEffect(() => {
    drawBase();
    drawOverlay();
  }, [drawBase, drawOverlay]);

  const getBarIndexFromX = useCallback(
    (clientX: number): number | null => {
      const container = containerRef.current;
      const layout = layoutRef.current;
      if (!container || !layout || !previewData) return null;
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left - CHART_LEFT;
      if (x < 0) return null;
      const idx = Math.floor(x / layout.barWidth);
      if (idx < 0 || idx >= normalizedBarsRef.current.length) return null;
      return idx;
    },
    [previewData]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (mouseRafRef.current) cancelAnimationFrame(mouseRafRef.current);
      const clientX = e.clientX;
      const clientY = e.clientY;
      mouseRafRef.current = requestAnimationFrame(() => {
        const idx = getBarIndexFromX(clientX);
        if (idx == null || !previewData) {
          setTooltip(null);
          if (hoveredSignalRef.current !== null) {
            hoveredSignalRef.current = null;
            drawOverlay();
          }
          return;
        }
        const sigIdx = previewData.signals.findIndex((sig) => sig.bar_index === idx);
        const next = sigIdx >= 0 ? sigIdx : null;
        if (hoveredSignalRef.current !== next) {
          hoveredSignalRef.current = next;
          drawOverlay();
        }
        const bar = normalizedBarsRef.current[idx];
        if (bar) {
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setTooltip({
              x: clientX - containerRect.left,
              y: clientY - containerRect.top,
              data: bar,
              signals: previewData.signals.filter((s) => s.bar_index === idx),
            });
          }
        }
      });
    },
    [getBarIndexFromX, previewData, drawOverlay]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    if (hoveredSignalRef.current !== null) {
      hoveredSignalRef.current = null;
      drawOverlay();
    }
  }, [drawOverlay]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (onLoadMore && e.deltaX < 0 && previewData?.pagination?.next_cursor) {
        onLoadMore(previewData.pagination.next_cursor);
      }
    },
    [onLoadMore, previewData]
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && searchValue.trim() && onSymbolChange) {
        onSymbolChange(searchValue.trim().toUpperCase());
      }
    },
    [searchValue, onSymbolChange]
  );

  const buyCount = previewData?.signals.filter((s) => s.side === 'buy').length ?? 0;
  const sellCount = previewData?.signals.filter((s) => s.side === 'sell').length ?? 0;

  return (
    <div className={s.klineContainer}>
      <div className={s.toolbar}>
        <input
          className={s.symbolSearch}
          type="text"
          placeholder={ui.klineChartSymbolSearch}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {loading && (
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{ui.klineChartLoading}</span>
        )}
        {downsampled && (
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
            {language === 'zh' ? `已降采样至 ${MAX_BARS} 条` : `Downsampled to ${MAX_BARS}`}
          </span>
        )}
        <div className={s.previewBadge}>
          {ui.klineChartPreviewEngine}
          <div className={s.previewTooltip}>{ui.klineChartPreviewEngineTooltip}</div>
        </div>
      </div>

      <div
        className={s.chartWrapper}
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <canvas ref={baseCanvasRef} className={s.baseCanvas} />
        <canvas ref={overlayCanvasRef} className={s.overlayCanvas} />

        {loading && <div className={s.loadingOverlay}>{ui.klineChartLoading}</div>}

        {!loading && (!previewData || previewData.bars.length === 0) && (
          <div className={s.emptyState}>
            <span>{language === 'zh' ? '暂无 K 线数据' : 'No bar data'}</span>
            <span>
              {language === 'zh' ? '请选择一个标的并点击"预览"' : 'Select a symbol and click Preview'}
            </span>
          </div>
        )}

        {loading && previewData && previewData.bars.length > 0 && (
          <div className={s.loadingBeacon}>{ui.klineChartLoading}</div>
        )}

        {tooltip && (
          <div
            className={s.tooltipOverlay}
            style={{
              left: clamp(tooltip.x, 80, (containerRef.current?.getBoundingClientRect().width ?? 600) - 80),
              top: clamp(tooltip.y, 60, (containerRef.current?.getBoundingClientRect().height ?? 400) - 60),
            }}
          >
            <div className={s.tooltipTitle}>{ui.klineChartOHLC}</div>
            <div className={s.tooltipRow}><span>O</span><span className={s.tooltipRowValue}>{formatPrice(tooltip.data.o)}</span></div>
            <div className={s.tooltipRow}><span>H</span><span className={s.tooltipRowValue}>{formatPrice(tooltip.data.h)}</span></div>
            <div className={s.tooltipRow}><span>L</span><span className={s.tooltipRowValue}>{formatPrice(tooltip.data.l)}</span></div>
            <div className={s.tooltipRow}><span>C</span><span className={s.tooltipRowValue}>{formatPrice(tooltip.data.c)}</span></div>
            <div className={s.tooltipRow}><span>Vol</span><span className={s.tooltipRowValue}>{tooltip.data.v.toLocaleString()}</span></div>
            {tooltip.signals.map((sig, i) => (
              <div key={i} className={s.tooltipSignal}>
                <div className={sig.side === 'buy' ? s.tooltipBuy : s.tooltipSell}>
                  {sig.side === 'buy' ? ui.klineChartBuy : ui.klineChartSell}
                  {' · '}
                  {sig.type}
                </div>
                {sig.reason && (
                  <div className={s.tooltipReason}>{ui.klineChartReason}: {sig.reason}</div>
                )}
                {sig.factor_snapshot && Object.keys(sig.factor_snapshot).length > 0 && (
                  <div className={s.tooltipReason}>
                    {ui.klineChartFactorSnapshot}: {JSON.stringify(sig.factor_snapshot)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showToast && (
          <div className={`${s.toast} ${toastHiding ? s.toastHiding : ''}`}>
            {ui.klineChartFingerprintChanged}
          </div>
        )}
      </div>

      {previewData && previewData.bars.length > 0 && (
        <div className={s.signalBar}>
          <span>{language === 'zh' ? '信号' : 'Signals'}:</span>
          <span className={s.signalCountBuy}>▲ {ui.klineChartBuy} {buyCount}</span>
          <span className={s.signalCountSell}>▼ {ui.klineChartSell} {sellCount}</span>
          <span>{language === 'zh' ? 'K线' : 'Bars'}: {previewData.bars.length}</span>
          <span>ID: {previewData.fingerprint?.slice(0, 12) ?? '-'}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 运行构建验证类型**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: 运行全量测试确认无回归**

Run: `cd apps/web && npx vitest run`
Expected: 现有测试全部通过

- [ ] **Step 5: 提交**

```bash
cd apps/web
git add src/components/kline-chart.tsx src/components/kline-chart-utils.ts src/styles/kline-chart.module.css
git commit -m "fix: K线图双 canvas 分层重写，修复 hover 导致的崩溃循环"
```

---

### Task 3: 策略总览简化（删除 config 中间页）

**Files:**
- Modify: `apps/web/src/components/strategy-page.tsx`
- Modify: `apps/web/src/components/strategy-grid-new.tsx`
- Create: `apps/web/tests/strategy-page.test.tsx`

**Interfaces:**
- Consumes: 无新接口
- Produces: `StrategyPage` props 收敛为 `{ strategies, workflowReady, onEnterWorkspace, ui, language }`；`StrategyGridNew` props 移除 `onSelectStrategy`

- [ ] **Step 1: 写策略总览交互测试**

创建 `apps/web/tests/strategy-page.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { StrategyGridNew } from '../src/components/strategy-grid-new';
import type { StrategyRow, UiCopy, LanguageCode } from '../src/appData';

const mockUi = {
  emptyStrategies: 'No strategies',
  enterWorkspace: 'Enter Workspace',
  strategyCategoryLabels: { factor_based: 'Factor', non_factor: 'Non-Factor', transitional: 'Transitional' },
  strategySubcategoryLabels: {},
} as unknown as UiCopy;

const mockStrategies: StrategyRow[] = [
  { id: 's1', name: 'dual_ma', description: '双均线', category: 'non_factor', subcategory: 'trend_cta', workflowReady: true, params: [] } as any,
  { id: 's2', name: 'rsi_reversal', description: 'RSI反转', category: 'non_factor', subcategory: 'trend_cta', workflowReady: false, params: [] } as any,
];

describe('StrategyGridNew', () => {
  it('groups strategies by category and subcategory', () => {
    render(
      <StrategyGridNew
        strategies={mockStrategies}
        onEnterWorkspace={() => {}}
        ui={mockUi}
        language={'zh' as LanguageCode}
      />
    );
    expect(screen.getByText('双均线')).toBeDefined();
    expect(screen.getByText('RSI反转')).toBeDefined();
  });

  it('clicking a card calls onEnterWorkspace', () => {
    const onEnter = vi.fn();
    render(
      <StrategyGridNew
        strategies={mockStrategies}
        onEnterWorkspace={onEnter}
        ui={mockUi}
        language={'zh' as LanguageCode}
      />
    );
    fireEvent.click(screen.getByText('双均线'));
    expect(onEnter).toHaveBeenCalledWith(expect.objectContaining({ name: 'dual_ma' }));
  });

  it('does not call onEnterWorkspace when workflowReady is false', () => {
    const onEnter = vi.fn();
    render(
      <StrategyGridNew
        strategies={mockStrategies}
        onEnterWorkspace={onEnter}
        ui={mockUi}
        language={'zh' as LanguageCode}
      />
    );
    fireEvent.click(screen.getByText('RSI反转'));
    expect(onEnter).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd apps/web && npx vitest run tests/strategy-page.test.tsx`
Expected: FAIL — `onSelectStrategy` is required prop, card click calls `onSelectStrategy` not `onEnterWorkspace`

- [ ] **Step 3: 简化 strategy-grid-new.tsx**

编辑 `apps/web/src/components/strategy-grid-new.tsx`：

1. 删除 `onSelectStrategy` prop：

```typescript
interface StrategyGridNewProps {
  strategies: StrategyRow[];
  onEnterWorkspace: (strategy: StrategyRow) => void;
  ui: UiCopy;
  language: LanguageCode;
}

export function StrategyGridNew({
  strategies,
  onEnterWorkspace,
  ui,
  language,
}: StrategyGridNewProps) {
```

2. 卡片整卡点击 + 移除"进入工作台"按钮，将卡片 div 替换为：

```tsx
<div
  className={`${s.card} ${strategy.workflowReady ? s.cardClickable : s.cardDisabled}`}
  key={strategy.id}
  onClick={() => {
    if (strategy.workflowReady) onEnterWorkspace(strategy);
  }}
  role="button"
  tabIndex={strategy.workflowReady ? 0 : -1}
  onKeyDown={(e) => {
    if ((e.key === 'Enter' || e.key === ' ') && strategy.workflowReady) {
      e.preventDefault();
      onEnterWorkspace(strategy);
    }
  }}
>
  <div className={s.cardName}>{strategy.name}</div>
  <div className={s.cardMeta}>
    <span className={`${s.subcategoryTag} ${subcategoryClass(category, s)}`}>
      {subcategoryLabel(strategy.subcategory ?? 'other')}
    </span>
  </div>
  {strategy.description && <p className={s.cardDesc}>{strategy.description}</p>}
</div>
```

3. 删除原 `cardAction` / `workspaceButton` 区块。

- [ ] **Step 4: 瘦身 strategy-page.tsx**

完整重写 `apps/web/src/components/strategy-page.tsx`：

```typescript
import type { StrategyRow, UiCopy, LanguageCode } from '../appData';
import { StrategyGridNew } from './strategy-grid-new';
import s from '../styles/strategy-page.module.css';

interface StrategyPageProps {
  strategies: StrategyRow[];
  onEnterWorkspace: (strategy: StrategyRow) => void;
  ui: UiCopy;
  language: LanguageCode;
}

export function StrategyPage({ strategies, onEnterWorkspace, ui, language }: StrategyPageProps) {
  return (
    <div>
      <StrategyGridNew
        strategies={strategies}
        onEnterWorkspace={onEnterWorkspace}
        ui={ui}
        language={language}
      />
    </div>
  );
}
```

- [ ] **Step 5: 在 strategy-page.module.css 增加 cardClickable/cardDisabled 样式**

编辑 `apps/web/src/styles/strategy-page.module.css`，在 `.card` 规则附近追加：

```css
.cardClickable {
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease, border-color 0.2s ease;
}

.cardClickable:hover {
  box-shadow: 0 4px 16px rgba(98, 216, 255, 0.15);
  border-color: rgba(98, 216, 255, 0.4);
  transform: translateY(-2px);
}

.cardDisabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 6: 运行测试验证通过**

Run: `cd apps/web && npx vitest run tests/strategy-page.test.tsx`
Expected: PASS

- [ ] **Step 7: 运行构建验证**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 无类型错误（App.tsx 无需改动，未传 onSelectStrategy）

- [ ] **Step 8: 提交**

```bash
cd apps/web
git add src/components/strategy-page.tsx src/components/strategy-grid-new.tsx src/styles/strategy-page.module.css tests/strategy-page.test.tsx
git commit -m "refactor: 策略总览删除 config 中间页，整卡点击直接进入研究台"
```

---

### Task 4: ConfigPanel 新增 onConfigSaved 回调

**Files:**
- Modify: `apps/web/src/components/config-panel.tsx`

**Interfaces:**
- Produces: `ConfigPanel` 新增可选 prop `onConfigSaved?: () => void`，保存成功后调用

- [ ] **Step 1: 修改 ConfigPanelProps 接口**

编辑 `apps/web/src/components/config-panel.tsx`，在 `ConfigPanelProps` 中新增 `onConfigSaved`：

```typescript
interface ConfigPanelProps {
  strategy: StrategyRow;
  ui: UiCopy;
  language: LanguageCode;
  onPreviewUpdate?: (data: PreviewResponse | null) => void;
  onConfigSaved?: () => void;
}
```

- [ ] **Step 2: 解构 onConfigSaved**

在组件函数签名中解构：

```typescript
export function ConfigPanel({ strategy, ui, language, onPreviewUpdate, onConfigSaved }: ConfigPanelProps) {
```

- [ ] **Step 3: 在 handleSave 成功分支调用 onConfigSaved**

在 `handleSave` 函数中，找到 `if (result && result.saved)` 分支，末尾追加调用：

```typescript
if (result && result.saved) {
  setSaved(true);
  if (result.configSnapshot?.hash) {
    setConfigHash(result.configSnapshot.hash);
  }
  setError(null);
  onConfigSaved?.();
}
```

- [ ] **Step 4: 运行类型检查**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 5: 提交**

```bash
cd apps/web
git add src/components/config-panel.tsx
git commit -m "feat: ConfigPanel 新增 onConfigSaved 回调，保存成功后通知父组件"
```

---

### Task 5: WorkspacePage 重构为三 Tab

**Files:**
- Modify: `apps/web/src/components/workspace-page.tsx`（重写）
- Modify: `apps/web/src/styles/workspace-page.module.css`
- Modify: `apps/web/tests/workspace-page.test.tsx`

**Interfaces:**
- Consumes: `ConfigPanel`（Task 4，含 onConfigSaved）、`KlineChart`（Task 2）
- Produces: `WorkspacePage` props 不变（`strategy / onBack / language / ui`），内部由 Stepper 改为 Tab

- [ ] **Step 1: 写三 Tab 交互测试**

编辑 `apps/web/tests/workspace-page.test.tsx`，新增用例（保留现有用例）：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkspacePage } from '../src/components/workspace-page';
import type { StrategyRow, UiCopy, LanguageCode } from '../src/appData';

const mockUi = {
  workspaceBackButton: 'Back',
  workspaceStep1Label: 'Diagnose',
  workspaceStep1Desc: 'Run diagnostics',
  workspaceStep2Label: 'Backtest',
  workspaceStep2Desc: 'Run backtest',
  workspaceRunDiagnostics: 'Run Diagnostics',
  workspaceConfirmStep2: 'Next',
  workspaceDiagnosticsRunning: 'Running...',
  workspaceDiagnosticsFailed: 'Failed',
  workspaceDiagnosticExpired: 'Expired',
  workspaceBacktestFailed: 'Failed',
  workspaceBacktestRunning: 'Running...',
  workspaceSubmitBacktest: 'Submit',
  workspaceBacktestConfigTitle: 'Config',
  workspaceBacktestSymbol: 'Symbol',
  workspaceBacktestTimeframe: 'Timeframe',
  workspaceBacktestInitialCapital: 'Capital',
  workspaceBacktestStartDate: 'Start',
  workspaceBacktestEndDate: 'End',
  workspaceConfigSummary: 'Summary',
  workspacePerformanceTitle: 'Performance',
  workspaceEquityCurve: 'Equity',
  workspaceTradeDetails: 'Trades',
  workspaceICSeries: 'IC',
  workspaceLayeredReturns: 'Layers',
  workspaceCorrelationHeatmap: 'Correlation',
  workspaceParamSensitivity: 'Sensitivity',
  workspaceSignalDist: 'Signal',
  workspaceSlippageStress: 'Slippage',
  workspaceSignalMetrics: 'Metrics',
  configPanelSaved: 'Saved',
  configPanelSave: 'Save',
  configPanelSaving: 'Saving',
  configPanelPreview: 'Preview',
  configPanelSubmitTask: 'Submit Task',
  configPanelSaveError: 'Save failed',
  configPanelBasicParams: 'Params',
  configPanelCategoryTabs: { factor_based: 'F', non_factor: 'N', transitional: 'T' },
  configPanelFactorPool: 'Factor Pool',
  configPanelFactorPoolPlaceholder: 'Search',
  configPanelPreprocessing: 'Preprocess',
  configPanelWinsorization: 'Winsor',
  configPanelNeutralization: 'Neutral',
  configPanelStandardization: 'Standard',
  configPanelWindowParams: 'Window',
  configPanelLookbackWindow: 'Lookback',
  configPanelHoldPeriod: 'Hold',
  configPanelIndicatorToolbox: 'Indicators',
  configPanelMACD: 'MACD',
  configPanelRSI: 'RSI',
  configPanelBollinger: 'Bollinger',
  configPanelDynamicParams: 'Dynamic',
  configPanelDataSource: 'Data Source',
  configPanelDecayHalfLife: 'Decay',
  configPanelMappingTarget: 'Mapping',
  klineChartSymbolSearch: 'Search',
  klineChartLoading: 'Loading',
  klineChartPreviewEngine: 'Preview',
  klineChartPreviewEngineTooltip: 'Tooltip',
  klineChartOHLC: 'OHLC',
  klineChartBuy: 'Buy',
  klineChartSell: 'Sell',
  klineChartReason: 'Reason',
  klineChartFactorSnapshot: 'Factors',
  klineChartFingerprintChanged: 'Changed',
  klineChartRSI: 'RSI',
  klineChartSpread: 'Spread',
  klineChartIC: 'IC',
  klineChartSentiment: 'Sentiment',
  workspaceTabConfig: '参数配置',
  workspaceTabDiagnose: '诊断',
  workspaceTabBacktest: '回测',
  workspaceNoConfigHint: '请先保存配置',
} as unknown as UiCopy;

const mockStrategy = {
  id: 's1',
  name: 'dual_ma',
  description: '双均线',
  category: 'non_factor',
  subcategory: 'trend_cta',
  params: [],
} as unknown as StrategyRow;

describe('WorkspacePage', () => {
  it('defaults to config tab', () => {
    render(<WorkspacePage strategy={mockStrategy} onBack={() => {}} language={'zh' as LanguageCode} ui={mockUi} />);
    expect(screen.getByText('参数配置')).toBeDefined();
  });

  it('switches to diagnose tab on click', () => {
    render(<WorkspacePage strategy={mockStrategy} onBack={() => {}} language={'zh' as LanguageCode} ui={mockUi} />);
    fireEvent.click(screen.getByText('诊断'));
    expect(screen.getByText('Run Diagnostics')).toBeDefined();
  });

  it('switches to backtest tab on click', () => {
    render(<WorkspacePage strategy={mockStrategy} onBack={() => {}} language={'zh' as LanguageCode} ui={mockUi} />);
    fireEvent.click(screen.getByText('回测'));
    expect(screen.getByText('Symbol')).toBeDefined();
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

Run: `cd apps/web && npx vitest run tests/workspace-page.test.tsx`
Expected: FAIL — 找不到"参数配置"Tab

- [ ] **Step 3: 在 zh.ts/en.ts 新增 Tab 文案**

编辑 `apps/web/src/data/zh.ts`，在 workspace 相关文案区块新增：

```typescript
workspaceTabConfig: '参数配置',
workspaceTabDiagnose: '诊断',
workspaceTabBacktest: '回测',
workspaceNoConfigHint: '请先在「参数配置」Tab 保存配置',
```

编辑 `apps/web/src/data/en.ts`，对应新增：

```typescript
workspaceTabConfig: 'Config',
workspaceTabDiagnose: 'Diagnose',
workspaceTabBacktest: 'Backtest',
workspaceNoConfigHint: 'Save config in the Config tab first',
```

- [ ] **Step 4: 在 workspace-page.module.css 增加 Tab 导航样式**

编辑 `apps/web/src/styles/workspace-page.module.css`，追加：

```css
.tabNav {
  display: flex;
  gap: 0;
  border-bottom: 1px solid var(--line);
  margin-bottom: 16px;
}

.tabButton {
  padding: 10px 20px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--muted);
  cursor: pointer;
  font-size: 14px;
  font-family: inherit;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.tabButton:hover {
  color: var(--text);
}

.tabButtonActive {
  color: var(--green, #62d8ff);
  border-bottom-color: var(--green, #62d8ff);
}

.tabContent {
  min-height: 400px;
}

.configTabLayout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  min-height: 500px;
}

@media (max-width: 1024px) {
  .configTabLayout {
    grid-template-columns: 1fr;
  }
}

.configPanelWrapper {
  min-height: 500px;
  overflow-y: auto;
}

.klinePanelWrapper {
  min-height: 500px;
}

.noConfigHint {
  padding: 40px;
  text-align: center;
  color: var(--muted);
}
```

- [ ] **Step 5: 重写 workspace-page.tsx**

完整重写 `apps/web/src/components/workspace-page.tsx`。核心改动：
- 顶部 Stepper → Tab 导航
- 新增 `WorkspaceTab` 类型 + `activeTab` state
- Tab 1：ConfigPanel + KlineChart（grid 布局）
- Tab 2：原 renderDiagnosticContent + handleRunDiagnostics
- Tab 3：原 renderBacktestContent + handleRunBacktest
- `configVersion` state，ConfigPanel onConfigSaved 后递增，触发 configSnapshot 重新读取

完整代码（保留原有 BarChart/HBarChart/HeatmapChart/LineChart/MiniGrid/ProgressBar/ErrorBox/helper 函数不变，重写 WorkspacePage 主组件）：

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import type { StrategyRow, UiCopy, LanguageCode, ConfigSnapshot, PreviewResponse } from '../appData';
import { apiPost } from '../api/client';
import { streamTask } from '../api/tasks';
import { fetchDiagnostic } from '../api/diagnostics';
import { submitBacktest, streamTask as streamBacktestTask } from '../api/tasks';
import { fetchStrategyConfig } from '../api/strategies-config';
import { ConfigPanel } from './config-panel';
import { KlineChart } from './kline-chart';
import { fetchPreview } from '../api/preview';
import s from '../styles/workspace-page.module.css';

type WorkspaceTab = 'config' | 'diagnose' | 'backtest';
type ProgressState = { percent: number; message: string } | null;

interface WorkspacePageProps {
  strategy: StrategyRow;
  onBack: () => void;
  language: LanguageCode;
  ui: UiCopy;
}

// ── 保留原有 helper 函数（BarChart/HBarChart/HeatmapChart/LineChart/MiniGrid/
//    getNestedNumber/extractBacktestResult/formatPercent/formatNumber/
//    formatTradeDate/formatTradeSide/ProgressBar/ErrorBox）──
// （此处省略，实施时保留原文件中这些函数不动）

export function WorkspacePage({ strategy, onBack, language, ui }: WorkspacePageProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('config');
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot | null>(null);
  const [configVersion, setConfigVersion] = useState(0);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const [klineLoading, setKlineLoading] = useState(false);
  const [klineSymbol, setKlineSymbol] = useState('600519');

  // 诊断状态（原 step 1）
  const [diagnosticData, setDiagnosticData] = useState<Record<string, unknown> | null>(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [diagnosticProgress, setDiagnosticProgress] = useState<ProgressState>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);
  const [diagnosticReady, setDiagnosticReady] = useState(false);

  // 回测状态（原 step 2）
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState<ProgressState>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [backtestResult, setBacktestResult] = useState<Record<string, unknown> | null>(null);
  const [backtestSubmitted, setBacktestSubmitted] = useState(false);
  const [backtestSymbol, setBacktestSymbol] = useState('600519');
  const [backtestTimeframe, setBacktestTimeframe] = useState('1d');
  const [backtestInitialCapital, setBacktestInitialCapital] = useState(1_000_000);
  const [backtestStartDate, setBacktestStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [backtestEndDate, setBacktestEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const configDefaultsApplied = useRef(false);

  const category = strategy.category ?? 'non_factor';

  // F5 recovery（保留原逻辑）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('diagnosticId');
    if (id) {
      fetchDiagnostic(id)
        .then((data) => {
          if (data) {
            setDiagnosticData(data.data);
            setDiagnosticReady(true);
          } else {
            setDiagnosticError(ui.workspaceDiagnosticExpired);
          }
        })
        .catch(() => setDiagnosticError(ui.workspaceDiagnosticExpired))
        .finally(() => setDiagnosticLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 读取 configSnapshot，依赖 configVersion
  useEffect(() => {
    configDefaultsApplied.current = false;
    fetchStrategyConfig(strategy.name)
      .then((res) => setConfigSnapshot(res?.configSnapshot ?? null))
      .catch((err) => console.warn('Failed to fetch strategy config:', err));
  }, [strategy.name, configVersion]);

  // 回测表单默认值从 configSnapshot 初始化
  useEffect(() => {
    if (configSnapshot?.params && !configDefaultsApplied.current) {
      configDefaultsApplied.current = true;
      const p = configSnapshot.params;
      if (typeof p.symbol === 'string') setBacktestSymbol(p.symbol);
      if (typeof p.timeframe === 'string') setBacktestTimeframe(p.timeframe);
      const initialCash =
        typeof p.initialCash === 'number'
          ? p.initialCash
          : typeof p.initialCapital === 'number'
            ? p.initialCapital
            : undefined;
      if (initialCash !== undefined) setBacktestInitialCapital(initialCash);
    }
  }, [configSnapshot]);

  const handleConfigSaved = useCallback(() => {
    setConfigVersion((v) => v + 1);
  }, []);

  const handlePreviewUpdate = useCallback((data: PreviewResponse | null) => {
    setPreviewData(data);
  }, []);

  const handleSymbolChange = useCallback(
    async (newSymbol: string) => {
      setKlineSymbol(newSymbol);
      setKlineLoading(true);
      try {
        const data = await fetchPreview(strategy.name, {
          symbol: newSymbol,
          timeframe: '1d',
          limit: 120,
          preview_params: {},
        });
        setPreviewData(data);
      } catch {
        // 静默失败
      } finally {
        setKlineLoading(false);
      }
    },
    [strategy.name]
  );

  const handleLoadMore = useCallback(
    async (cursor: number) => {
      if (!previewData) return;
      setKlineLoading(true);
      try {
        const data = await fetchPreview(strategy.name, {
          symbol: klineSymbol,
          timeframe: '1d',
          cursor,
          limit: 50,
          preview_params: {},
        });
        if (data.bars.length > 0) {
          setPreviewData({ ...data, bars: [...data.bars, ...previewData.bars] });
        }
      } catch {
        // 静默失败
      } finally {
        setKlineLoading(false);
      }
    },
    [strategy.name, klineSymbol, previewData]
  );

  // ── 诊断（原 handleRunDiagnostics，保留逻辑）──
  const handleRunDiagnostics = useCallback(async () => {
    setDiagnosticLoading(true);
    setDiagnosticError(null);
    setDiagnosticProgress({ percent: 0, message: language === 'zh' ? '启动诊断任务…' : 'Starting diagnostics…' });
    try {
      const { id: taskId } = await apiPost<{ id: string; status: string }>('/tasks', {
        type: 'diagnostics',
        payload: {
          strategy: strategy.name,
          configSnapshot: configSnapshot ?? { strategy: strategy.name, params: {} },
          category,
        },
      });
      const close = streamTask(
        taskId,
        (event) => {
          if (event.type === 'progress') {
            setDiagnosticProgress({ percent: event.percent ?? 0, message: event.message ?? '' });
          } else if (event.type === 'result') {
            const result = event.data as { data?: Record<string, unknown>; diagnostics?: Record<string, unknown>; resultId?: string; resultType?: string };
            if (result?.resultId) {
              const url = new URL(window.location.href);
              url.searchParams.set('diagnosticId', result.resultId);
              window.history.replaceState({}, '', url.toString());
              fetchDiagnostic(result.resultId).then((data) => {
                if (data) { setDiagnosticData(data.data); setDiagnosticReady(true); }
              });
            }
            const diagnostics = result?.diagnostics ?? result?.data;
            if (diagnostics) { setDiagnosticData(diagnostics); setDiagnosticReady(true); }
            setDiagnosticProgress({ percent: 100, message: language === 'zh' ? '诊断完成' : 'Diagnostics complete' });
            close();
          } else if (event.type === 'error') {
            setDiagnosticError(event.error?.message ?? ui.workspaceDiagnosticsFailed);
            close();
          }
        },
        () => setDiagnosticError('SSE connection failed')
      );
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : ui.workspaceDiagnosticsFailed);
    } finally {
      setDiagnosticLoading(false);
    }
  }, [strategy.name, category, configSnapshot, language, ui.workspaceDiagnosticsFailed]);

  // ── 回测（原 handleRunBacktest，保留逻辑）──
  const handleRunBacktest = useCallback(async () => {
    setBacktestLoading(true);
    setBacktestError(null);
    setBacktestProgress({ percent: 0, message: language === 'zh' ? '启动回测…' : 'Starting backtest…' });
    try {
      const { id: taskId } = await submitBacktest({
        strategy: strategy.name,
        symbol: backtestSymbol,
        timeframe: backtestTimeframe,
        initialCash: backtestInitialCapital,
        configSnapshot: configSnapshot ?? { strategy: strategy.name, params: {} },
        startTs: new Date(backtestStartDate).getTime(),
        endTs: new Date(backtestEndDate).getTime(),
      });
      const close = streamBacktestTask(
        taskId,
        (event) => {
          if (event.type === 'progress') {
            setBacktestProgress({ percent: event.percent ?? 0, message: event.message ?? '' });
          } else if (event.type === 'result') {
            const data = event.data as Record<string, unknown> | undefined;
            if (data) setBacktestResult(data);
            setBacktestSubmitted(true);
            setBacktestProgress({ percent: 100, message: language === 'zh' ? '回测完成' : 'Backtest complete' });
            close();
          } else if (event.type === 'error') {
            setBacktestError(event.error?.message ?? ui.workspaceBacktestFailed);
            close();
          }
        },
        () => setBacktestError('SSE connection failed')
      );
    } catch (err) {
      setBacktestError(err instanceof Error ? err.message : ui.workspaceBacktestFailed);
    } finally {
      setBacktestLoading(false);
    }
  }, [strategy.name, configSnapshot, language, ui.workspaceBacktestFailed, backtestSymbol, backtestTimeframe, backtestInitialCapital, backtestStartDate, backtestEndDate]);

  // parseFactorDiagnostics / parseNonFactorDiagnostics / renderDiagnosticContent / renderBacktestContent
  // 保留原文件中这些函数的实现，仅将 renderDiagnosticContent 和 renderBacktestContent 作为
  // 内联渲染使用（不再依赖 step state）

  return (
    <div className={s.workspacePage}>
      <button className={s.backButton} onClick={onBack} type="button">{ui.workspaceBackButton}</button>

      <div className={s.workspaceHeader}>
        <h2 className={s.workspaceTitle}>{strategy.name}</h2>
        <span className={s.workspaceSubtitle}>{strategy.description}</span>
      </div>

      {/* Tab 导航 */}
      <div className={s.tabNav}>
        {([
          { key: 'config' as const, label: ui.workspaceTabConfig },
          { key: 'diagnose' as const, label: ui.workspaceTabDiagnose },
          { key: 'backtest' as const, label: ui.workspaceTabBacktest },
        ]).map((tab) => (
          <button
            key={tab.key}
            className={`${s.tabButton} ${activeTab === tab.key ? s.tabButtonActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={s.tabContent}>
        {activeTab === 'config' && (
          <div className={s.configTabLayout}>
            <div className={s.configPanelWrapper}>
              <ConfigPanel
                strategy={strategy}
                ui={ui}
                language={language}
                onPreviewUpdate={handlePreviewUpdate}
                onConfigSaved={handleConfigSaved}
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
              />
            </div>
          </div>
        )}

        {activeTab === 'diagnose' && (
          <div>
            {!configSnapshot ? (
              <div className={s.noConfigHint}>{ui.workspaceNoConfigHint}</div>
            ) : (
              <>
                <div className={s.diagnosticActions}>
                  <button className={s.primaryButton} onClick={handleRunDiagnostics} disabled={diagnosticLoading} type="button">
                    {diagnosticLoading ? ui.workspaceDiagnosticsRunning : ui.workspaceRunDiagnostics}
                  </button>
                </div>
                <ProgressBar progress={diagnosticProgress} />
                {diagnosticError && <ErrorBox message={diagnosticError} onRetry={handleRunDiagnostics} />}
                {/* renderDiagnosticContent() 调用 — 保留原实现 */}
                {!diagnosticLoading && !diagnosticError && !diagnosticReady && !diagnosticData && (
                  <div className={s.emptyState}>
                    <span>{language === 'zh' ? '点击「开始诊断」分析策略特征' : 'Click "Run Diagnostics" to analyze'}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'backtest' && (
          <div>
            {!configSnapshot ? (
              <div className={s.noConfigHint}>{ui.workspaceNoConfigHint}</div>
            ) : (
              <>
                <div className={s.chartCardTitle}>{ui.workspaceConfigSummary}</div>
                {/* renderBacktestContent() 调用 — 保留原实现 */}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

**实施说明**：实施时保留原 workspace-page.tsx 中所有 helper 函数（BarChart/HBarChart/HeatmapChart/LineChart/MiniGrid/getNestedNumber/extractBacktestResult/formatPercent/formatNumber/formatTradeDate/formatTradeSide/ProgressBar/ErrorBox/parseFactorDiagnostics/parseNonFactorDiagnostics/renderDiagnosticContent/renderBacktestContent）原样不动，仅替换 `WorkspacePage` 主组件函数体。`renderDiagnosticContent` 和 `renderBacktestContent` 改为在 diagnose/backtest Tab 内直接调用。

- [ ] **Step 6: 运行测试验证通过**

Run: `cd apps/web && npx vitest run tests/workspace-page.test.tsx`
Expected: PASS

- [ ] **Step 7: 运行全量测试**

Run: `cd apps/web && npx vitest run`
Expected: 所有测试通过

- [ ] **Step 8: 运行构建**

Run: `cd apps/web && npm run build`
Expected: 构建成功

- [ ] **Step 9: 提交**

```bash
cd apps/web
git add src/components/workspace-page.tsx src/styles/workspace-page.module.css src/data/zh.ts src/data/en.ts tests/workspace-page.test.tsx
git commit -m "refactor: 研究台 Stepper 改三 Tab，吸收 ConfigPanel + KlineChart"
```

---

### Task 6: 集成验证与文档同步

**Files:**
- Verify: 全部前序 Task 产出
- Update: `apps/web/README.md`, `apps/web/AGENT.md`

- [ ] **Step 1: 运行 AGENT.md 强制验证命令**

```bash
cd apps/web
npm test
npm run build
npm list --depth=0
```

Expected: 三命令全部成功

- [ ] **Step 2: 浏览器手动验证 K线图性能**

启动 dev server（`npm run dev`），在策略总览点击策略进入研究台 config Tab，点击"预览"按钮：
- 150 bars：鼠标快速来回移动 10 秒，CPU 不持续 100%
- 切换子分类：副图正确刷新
- 切换 Tab 到诊断/回测：正常切换
- 无 configSnapshot 时 Tab 2/3 显示空态提示

- [ ] **Step 3: 浏览器验证三 Tab 流转**

- 策略总览点卡片 → 进入研究台 config Tab + 侧边栏高亮 workspace
- ConfigPanel 保存 → 切到 diagnose Tab → 诊断可用
- 切到 backtest Tab → 回测表单可用
- 无 configSnapshot 时 Tab 2/3 空态提示

- [ ] **Step 4: 回归验证**

- Dashboard / 回测报告 / 因子工坊 / 数据中心 / 任务中心页面不受影响
- 双语切换正常

- [ ] **Step 5: 更新 apps/web/README.md**

在"当前阶段"或信息架构章节追加：
- 研究台三 Tab 架构（参数配置+K线预览 / 诊断 / 回测）
- K线图双 canvas 分层，MAX_BARS=1500
- 策略总览整卡点击直接进入研究台

- [ ] **Step 6: 更新 apps/web/AGENT.md**

在"当前阶段"区块追加：
- 研究台三 Tab 架构（config/diagnose/backtest）
- K线图双 canvas 分层（baseCanvas + overlayCanvas），hoveredSignal 用 ref 解耦
- 策略总览删除 config 中间页，整卡点击进入研究台

- [ ] **Step 7: 提交文档同步**

```bash
cd apps/web
git add README.md AGENT.md
git commit -m "docs: 同步研究台三 Tab + K线双 canvas 架构到 README/AGENT"
```

- [ ] **Step 8: 推送分支**

```bash
git push origin ralph/backend-sync-realign-phase6-9
```

---

## Self-Review

### Spec coverage

| Spec 要求 | 对应 Task |
|-----------|----------|
| K线图崩溃修复（双 canvas + ref 解耦） | Task 1（纯函数）+ Task 2（重写） |
| 策略总览按分类/子分类展示 | Task 3（保留分组，整卡点击） |
| 侧边导航跳转研究台 | Task 3（整卡点击 → onEnterWorkspace → App.tsx 已有逻辑） |
| 删除 config 中间页 | Task 3（strategy-page 瘦身） |
| 研究台吸收 ConfigPanel + K线 | Task 5（Tab 1 容纳） |
| 三 Tab 架构 | Task 5 |
| configVersion 跨 Tab 通信 | Task 4（onConfigSaved）+ Task 5（configVersion state） |
| MAX_BARS=1500 降采样 | Task 2 |
| 回测表单只保留运行参数 | Task 5（原表单保留，策略参数从 configSnapshot 只读） |
| 新增文案进入 zh.ts/en.ts | Task 5 Step 3 |
| 验证命令 npm test/build/list | Task 6 Step 1 |
| 文档同步 README/AGENT.md | Task 6 Step 5-6 |

### Placeholder scan

无 TBD/TODO/占位符。Task 5 中 `renderDiagnosticContent`/`renderBacktestContent` 标注"保留原实现"，因原文件已有完整代码，实施时复制保留——这是明确的实施指令，非占位符。

### Type consistency

- `WorkspaceTab` 在 Task 5 定义为 `'config' | 'diagnose' | 'backtest'`，测试中使用相同值
- `onConfigSaved` 在 Task 4 定义为 `() => void`，Task 5 中 `handleConfigSaved` 匹配
- `NormalizedBar`/`ChartLayout` 在 Task 1 定义，Task 2 import 引用
- `MAX_BARS = 1500` 在 Task 2 定义，与 spec 一致
