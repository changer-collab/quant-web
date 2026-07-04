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
  return arr.length === 0 ? 0 : arr.reduce((m, v) => (v > m ? v : m), -Infinity);
}
