import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  PreviewResponse,
  UiCopy,
  LanguageCode,
  BarData,
  ChartOverlay,
  PreviewSignal,
} from '../appData';
import s from '../styles/kline-chart.module.css';

// ─── 常量 ────────────────────────────────────────────────

const CHART_TOP = 36;
const CHART_BOTTOM = 28;
const CHART_LEFT = 54;
const CHART_RIGHT = 10;
const GAP_BETWEEN_CHARTS = 2;

const CANDLE_WIDTH_RATIO = 0.6; // 蜡烛体占 bar 宽度的比例
const MIN_BAR_WIDTH = 3;

const MA_COLORS = ['#62d8ff', '#e9c46a', '#f472b6', '#a78bfa'];
const COLOR_UP = '#ef4444';   // 红涨
const COLOR_DOWN = '#22c55e'; // 绿跌
const COLOR_GRID = 'rgba(98, 110, 110, 0.15)';
const COLOR_TEXT = 'rgba(150, 160, 160, 0.7)';
const COLOR_VOLUME_UP = 'rgba(239, 68, 68, 0.35)';
const COLOR_VOLUME_DOWN = 'rgba(34, 197, 94, 0.35)';

const OVERBOUGHT = 70;
const OVERSOLD = 30;
const DEFAULT_RSI_PERIOD = 14;
const FINGERPRINT_TOAST_DURATION = 3000;

// ─── 工具函数 ────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/** 计算 SMA */
function computeSMA(values: (number | null)[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    let sum = 0;
    let cnt = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const v = values[j];
      if (v != null && !Number.isNaN(v)) { sum += v; cnt++; }
    }
    out.push(cnt >= period * 0.5 ? sum / cnt : null);
  }
  return out;
}

/** 计算 RSI (Wilder 平滑) */
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

/** 格式化价格（根据数值自动决定小数位） */
function formatPrice(v: number): string {
  if (v >= 1000) return v.toFixed(2);
  if (v >= 10) return v.toFixed(2);
  if (v >= 1) return v.toFixed(3);
  return v.toFixed(4);
}

// ─── 布局计算 ────────────────────────────────────────────

interface ChartLayout {
  main: { x: number; y: number; w: number; h: number };
  volume: { x: number; y: number; w: number; h: number };
  sub: { x: number; y: number; w: number; h: number };
  barWidth: number;
  visibleCount: number;
}

function computeLayout(
  cw: number,
  ch: number,
  barCount: number,
  hasSubChart: boolean,
): ChartLayout {
  const volH = 50;
  const subH = hasSubChart ? 50 : 0;
  const mainH = ch - CHART_TOP - CHART_BOTTOM - volH - subH - GAP_BETWEEN_CHARTS * 2;
  const chartW = cw - CHART_LEFT - CHART_RIGHT;
  const barWidth = Math.max(MIN_BAR_WIDTH, chartW / barCount);
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

// ─── Canvas 绘制函数 ─────────────────────────────────────

/** 绘制网格和坐标轴 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  layout: ChartLayout,
  priceMin: number,
  priceMax: number,
  barCount: number,
) {
  const { main, volume } = layout;
  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 0.5;

  // 水平网格线（主图 5 条）
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

  // 垂直网格线
  const vStep = Math.max(1, Math.floor(barCount / 8));
  for (let i = 0; i < barCount; i += vStep) {
    const x = main.x + i * layout.barWidth;
    ctx.beginPath();
    ctx.moveTo(x, CHART_TOP);
    ctx.lineTo(x, CHART_TOP + main.h + volume.h + (layout.sub.h > 0 ? layout.sub.h + GAP_BETWEEN_CHARTS : 0));
    ctx.stroke();
  }

  // 价格标签（右轴）
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '10px monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= priceSteps; i++) {
    const price = priceMax - ((priceMax - priceMin) / priceSteps) * i;
    const y = main.y + (main.h / priceSteps) * i;
    ctx.fillText(formatPrice(price), main.x - 4, y + 3);
  }

  // 时间标签（底轴）
  ctx.textAlign = 'center';
  for (let i = 0; i < barCount; i += vStep) {
    const x = main.x + i * layout.barWidth + layout.barWidth / 2;
    ctx.fillText(`#${i + 1}`, x, CHART_TOP + main.h + volume.h + (layout.sub.h > 0 ? layout.sub.h + 14 : 14) + GAP_BETWEEN_CHARTS);
  }
}

/** 绘制 K 线蜡烛 */
function drawCandlesticks(
  ctx: CanvasRenderingContext2D,
  bars: BarData[],
  layout: ChartLayout,
  priceMin: number,
  priceMax: number,
) {
  const { main, barWidth } = layout;
  const range = priceMax - priceMin || 1;
  const candleW = Math.max(2, barWidth * CANDLE_WIDTH_RATIO);
  const halfW = candleW / 2;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const x = main.x + i * barWidth + barWidth / 2;
    const isUp = b.close >= b.open;
    const color = isUp ? COLOR_UP : COLOR_DOWN;
    const openY = main.y + main.h - ((b.open - priceMin) / range) * main.h;
    const closeY = main.y + main.h - ((b.close - priceMin) / range) * main.h;
    const highY = main.y + main.h - ((b.high - priceMin) / range) * main.h;
    const lowY = main.y + main.h - ((b.low - priceMin) / range) * main.h;

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    // 上/下影线
    ctx.beginPath();
    ctx.moveTo(x, highY);
    ctx.lineTo(x, lowY);
    ctx.stroke();

    // 蜡烛体
    const bodyTop = Math.min(openY, closeY);
    const bodyBot = Math.max(openY, closeY);
    const bodyH = Math.max(1, bodyBot - bodyTop);
    ctx.fillStyle = color;
    ctx.fillRect(x - halfW, bodyTop, candleW, bodyH);
  }
}

/** 绘制均线叠加 */
function drawOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: ChartOverlay[],
  layout: ChartLayout,
  priceMin: number,
  priceMax: number,
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
      if (v == null || Number.isNaN(v)) { started = false; continue; }
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

/** 绘制成交量柱状图 */
function drawVolume(
  ctx: CanvasRenderingContext2D,
  bars: BarData[],
  layout: ChartLayout,
) {
  const { volume, barWidth } = layout;
  if (volume.h <= 0) return;

  const maxVol = Math.max(...bars.map(b => b.volume), 1);
  const halfW = Math.max(1, barWidth * CANDLE_WIDTH_RATIO / 2);

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const isUp = b.close >= b.open;
    const h = (b.volume / maxVol) * volume.h;
    ctx.fillStyle = isUp ? COLOR_VOLUME_UP : COLOR_VOLUME_DOWN;
    ctx.fillRect(volume.x + i * barWidth + barWidth / 2 - halfW, volume.y + volume.h - h, halfW * 2, h);
  }
}

/** 绘制策略专属副图 */
function drawSubChart(
  ctx: CanvasRenderingContext2D,
  bars: BarData[],
  subcategory: string | null | undefined,
  layout: ChartLayout,
  subLabel: string,
) {
  const { sub, barWidth } = layout;
  if (sub.h <= 0) return;

  const closes = bars.map(b => b.close);
  const subcat = subcategory ?? '';

  let data: (number | null)[];
  let yMin = 0;
  let yMax = 100;

  if (subcat === 'trend_cta') {
    // RSI
    data = computeRSI(closes, DEFAULT_RSI_PERIOD);
    yMin = 0;
    yMax = 100;
  } else if (subcat === 'arbitrage' || subcat === 'hft_microstructure') {
    // 价差 = (high - low) / close
    data = bars.map(b => ((b.high - b.low) / b.close) * 100);
    yMin = 0;
    const vals = data.filter((d): d is number => d != null);
    yMax = vals.length > 0 ? Math.max(...vals) * 1.2 : 10;
  } else if (subcat === 'macro_quant') {
    // 滚动波动率
    const returns = closes.map((c, i) => i === 0 ? 0 : (c - closes[i - 1]) / closes[i - 1]);
    data = computeSMA(returns.map(r => Math.abs(r) * 100), 10);
    const vals = data.filter((d): d is number => d != null);
    yMin = 0;
    yMax = vals.length > 0 ? Math.max(...vals) * 1.2 : 5;
  } else if (subcat === 'e2e_ai_timeseries' || subcat === 'factor_based' || subcat === 'ml_nonlinear_factor' || subcat === 'linear_multi_factor') {
    // 模拟 IC 状曲线：close 的归一化变化
    const base = closes[0] || 1;
    data = closes.map(c => ((c - base) / base) * 100);
    const vals = data.filter((d): d is number => d != null);
    yMin = vals.length > 0 ? Math.min(...vals) * 1.2 : -5;
    yMax = vals.length > 0 ? Math.max(...vals) * 1.2 : 5;
  } else if (subcat === 'event_driven' || subcat === 'transitional') {
    // 情感得分：成交量相对均值偏离
    const avgVol = bars.reduce((s, b) => s + b.volume, 0) / bars.length || 1;
    data = bars.map(b => ((b.volume - avgVol) / avgVol) * 100);
    const vals = data.filter((d): d is number => d != null);
    yMin = Math.min(...vals) * 1.2;
    yMax = Math.max(...vals) * 1.2;
  } else {
    data = closes.map(() => 50);
    yMin = 0;
    yMax = 100;
  }

  const range = yMax - yMin || 1;

  // 画参考线（RSI 的 70/30）
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

    // 标签
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(OVERBOUGHT), sub.x - 2, sub.y + sub.h - ((OVERBOUGHT - yMin) / range) * sub.h + 3);
    ctx.fillText(String(OVERSOLD), sub.x - 2, sub.y + sub.h - ((OVERSOLD - yMin) / range) * sub.h + 3);
  }

  // 画副图数据线
  ctx.strokeStyle = '#62d8ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v == null || Number.isNaN(v)) { started = false; continue; }
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

  // 副图标签
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '9px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(subLabel, sub.x + 4, sub.y + 12);
}

/** 绘制买卖信号箭头 */
function drawSignals(
  ctx: CanvasRenderingContext2D,
  signals: PreviewSignal[],
  bars: BarData[],
  layout: ChartLayout,
  priceMin: number,
  priceMax: number,
  hoveredSignal: number | null,
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
      ? main.y + main.h - ((bar.low - priceMin) / range) * main.h - 4
      : main.y + main.h - ((bar.high - priceMin) / range) * main.h + 4;

    const isHovered = hoveredSignal === si;
    const size = isHovered ? 7 : 5;

    ctx.fillStyle = color;
    ctx.beginPath();
    if (isBuy) {
      // 上箭头
      ctx.moveTo(x, yBase - size);
      ctx.lineTo(x - size, yBase);
      ctx.lineTo(x + size, yBase);
    } else {
      // 下箭头
      ctx.moveTo(x, yBase + size);
      ctx.lineTo(x - size, yBase);
      ctx.lineTo(x + size, yBase);
    }
    ctx.closePath();
    ctx.fill();

    // 高亮 glow
    if (isHovered) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// ─── Props ────────────────────────────────────────────────

export interface KlineChartProps {
  previewData: PreviewResponse | null;
  subcategory?: string | null;
  ui: UiCopy;
  language: LanguageCode;
  onSymbolChange?: (symbol: string) => void;
  onLoadMore?: (cursor: number) => void;
  loading?: boolean;
}

// ─── 主组件 ───────────────────────────────────────────────

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prevFingerprintRef = useRef<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    data: BarData;
    signals: PreviewSignal[];
  } | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastHiding, setToastHiding] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [hoveredSignal, setHoveredSignal] = useState<number | null>(null);
  const [containerDims, setContainerDims] = useState({ w: 600, h: 400 });

  // ── fingerprint 变更检测 ─────────────────────────────────
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

  // ── Canvas 绘制 ─────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width;
    const h = rect.height;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);

    // 清空
    ctx.clearRect(0, 0, w, h);

    // 空数据
    if (!previewData || previewData.bars.length === 0) return;

    const { bars, overlays, signals } = previewData;
    const layout = computeLayout(w, h, bars.length, true);

    // 价格范围
    let priceMin = Infinity;
    let priceMax = -Infinity;
    for (const b of bars) {
      if (b.low < priceMin) priceMin = b.low;
      if (b.high > priceMax) priceMax = b.high;
    }
    // 加入均线范围
    for (const ov of overlays) {
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

    // 1. 网格
    drawGrid(ctx, layout, priceMin, priceMax, bars.length);

    // 2. 成交量
    drawVolume(ctx, bars, layout);

    // 3. 主图 K 线
    drawCandlesticks(ctx, bars, layout, priceMin, priceMax);

    // 4. 均线叠加
    drawOverlays(ctx, overlays, layout, priceMin, priceMax);

    // 5. 策略专属副图
    let subLabel = ui.klineChartRSI;
    if (subcategory && ['arbitrage', 'hft_microstructure'].includes(subcategory)) {
      subLabel = ui.klineChartSpread;
    } else if (subcategory && ['factor_based', 'linear_multi_factor', 'ml_nonlinear_factor', 'e2e_ai_timeseries'].includes(subcategory)) {
      subLabel = ui.klineChartIC;
    } else if (subcategory && ['transitional', 'event_driven'].includes(subcategory)) {
      subLabel = ui.klineChartSentiment;
    }
    drawSubChart(ctx, bars, subcategory, layout, subLabel);

    // 6. 信号
    drawSignals(ctx, signals, bars, layout, priceMin, priceMax, hoveredSignal);
  }, [previewData, subcategory, hoveredSignal, ui]);

  // 窗口 resize
  useEffect(() => {
    draw();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      draw();
      const entry = entries[0];
      if (entry) {
        setContainerDims({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [draw]);

  // ── 鼠标事件 ────────────────────────────────────────────

  const getBarIndexFromX = useCallback((clientX: number): number | null => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas || !previewData) return null;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left - CHART_LEFT;
    if (x < 0) return null;
    const layout = computeLayout(rect.width, rect.height, previewData.bars.length, true);
    const idx = Math.floor(x / layout.barWidth);
    if (idx < 0 || idx >= previewData.bars.length) return null;
    return idx;
  }, [previewData]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const idx = getBarIndexFromX(e.clientX);
    if (idx == null || !previewData) {
      setTooltip(null);
      setHoveredSignal(null);
      return;
    }

    // 检测是否悬停在信号上
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container && canvas && previewData) {
      const sigIdx = previewData.signals.findIndex(sig => sig.bar_index === idx);
      setHoveredSignal(sigIdx >= 0 ? sigIdx : null);
    }

    const bar = previewData.bars[idx];
    const barSignals = previewData.signals.filter(s => s.bar_index === idx);
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (containerRect) {
      setTooltip({
        x: e.clientX - containerRect.left,
        y: e.clientY - containerRect.top,
        data: bar,
        signals: barSignals,
      });
    }
  }, [getBarIndexFromX, previewData]);

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
    setHoveredSignal(null);
  }, []);

  // ── 时间轴拖拽 / 滚轮加载更多 ──────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // 滚动到左边界触发加载更多
    if (onLoadMore && e.deltaX < 0 && previewData?.pagination?.next_cursor) {
      onLoadMore(previewData.pagination.next_cursor);
    }
  }, [onLoadMore, previewData]);

  // ── 搜索 ────────────────────────────────────────────────

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchValue.trim() && onSymbolChange) {
      onSymbolChange(searchValue.trim().toUpperCase());
    }
  }, [searchValue, onSymbolChange]);

  // ── 底部信号计数 ────────────────────────────────────────

  const buyCount = previewData?.signals.filter(s => s.side === 'buy').length ?? 0;
  const sellCount = previewData?.signals.filter(s => s.side === 'sell').length ?? 0;

  // ── Render ──────────────────────────────────────────────

  return (
    <div className={s.klineContainer}>
      {/* 顶部工具栏 */}
      <div className={s.toolbar}>
        <input
          className={s.symbolSearch}
          type="text"
          placeholder={ui.klineChartSymbolSearch}
          value={searchValue}
          onChange={e => setSearchValue(e.target.value)}
          onKeyDown={handleSearchKeyDown}
        />
        {loading && (
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>{ui.klineChartLoading}</span>
        )}
        <div className={s.previewBadge}>
          {ui.klineChartPreviewEngine}
          <div className={s.previewTooltip}>{ui.klineChartPreviewEngineTooltip}</div>
        </div>
      </div>

      {/* Canvas 区域 */}
      <div
        className={s.chartWrapper}
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className={s.chartCanvas} />

        {/* Loading overlay */}
        {loading && (
          <div className={s.loadingOverlay}>{ui.klineChartLoading}</div>
        )}

        {/* 空状态 */}
        {!loading && (!previewData || previewData.bars.length === 0) && (
          <div className={s.emptyState}>
            <span>{language === 'zh' ? '暂无 K 线数据' : 'No bar data'}</span>
            <span>{language === 'zh' ? '请选择一个标的并点击"预览"' : 'Select a symbol and click Preview'}</span>
          </div>
        )}

        {/* Loading beacon（滚动加载更多） */}
        {loading && previewData && previewData.bars.length > 0 && (
          <div className={s.loadingBeacon}>{ui.klineChartLoading}</div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div
            className={s.tooltipOverlay}
            style={{
              left: clamp(tooltip.x, 80, containerDims.w - 80),
              top: clamp(tooltip.y, 60, containerDims.h - 60),
            }}
          >
            <div className={s.tooltipTitle}>
              {ui.klineChartOHLC}
            </div>
            <div className={s.tooltipRow}>
              <span>O</span>
              <span className={s.tooltipRowValue}>{formatPrice(tooltip.data.open)}</span>
            </div>
            <div className={s.tooltipRow}>
              <span>H</span>
              <span className={s.tooltipRowValue}>{formatPrice(tooltip.data.high)}</span>
            </div>
            <div className={s.tooltipRow}>
              <span>L</span>
              <span className={s.tooltipRowValue}>{formatPrice(tooltip.data.low)}</span>
            </div>
            <div className={s.tooltipRow}>
              <span>C</span>
              <span className={s.tooltipRowValue}>{formatPrice(tooltip.data.close)}</span>
            </div>
            <div className={s.tooltipRow}>
              <span>Vol</span>
              <span className={s.tooltipRowValue}>{tooltip.data.volume.toLocaleString()}</span>
            </div>
            {tooltip.signals.map((sig, i) => (
              <div key={i} className={s.tooltipSignal}>
                <div className={sig.side === 'buy' ? s.tooltipBuy : s.tooltipSell}>
                  {sig.side === 'buy' ? ui.klineChartBuy : ui.klineChartSell}
                  {' · '}{sig.type}
                </div>
                {sig.reason && (
                  <div className={s.tooltipReason}>
                    {ui.klineChartReason}: {sig.reason}
                  </div>
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

        {/* Fingerprint change toast */}
        {showToast && (
          <div className={`${s.toast} ${toastHiding ? s.toastHiding : ''}`}>
            {ui.klineChartFingerprintChanged}
          </div>
        )}
      </div>

      {/* 底部信号计数 */}
      {previewData && previewData.bars.length > 0 && (
        <div className={s.signalBar}>
          <span>{language === 'zh' ? '信号' : 'Signals'}:</span>
          <span className={s.signalCountBuy}>
            ▲ {ui.klineChartBuy} {buyCount}
          </span>
          <span className={s.signalCountSell}>
            ▼ {ui.klineChartSell} {sellCount}
          </span>
          <span>
            {language === 'zh' ? 'K线' : 'Bars'}: {previewData.bars.length}
          </span>
          <span>
            ID: {previewData.fingerprint?.slice(0, 12) ?? '-'}
          </span>
        </div>
      )}
    </div>
  );
}
