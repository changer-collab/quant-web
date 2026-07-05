import React, { useState, useEffect, useRef, useCallback } from 'react';
import type {
  PreviewResponse,
  UiCopy,
  LanguageCode,
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
