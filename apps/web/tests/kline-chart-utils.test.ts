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
