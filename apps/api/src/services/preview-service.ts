/**
 * Preview Service — 轻量预览引擎
 *
 * 纯 TypeScript 实现 SMA/EMA/RSI/MACD 四类指标的 K 线叠加计算，
 * 以及金叉死叉/超买超卖信号标注。
 * 不依赖外部数学或金融库。
 */

import { createHash } from 'node:crypto';

// ─── 公开类型 ─────────────────────────────────────────────────────────────

export interface ChartOverlay {
  name: string;
  type: 'line' | 'bar' | 'zone';
  data: Array<{ timestamp: number; value: number }>;
}

export interface PreviewSignal {
  timestamp: number;
  side: 'buy' | 'sell';
  type: string;
  reason: string;
}

export interface PreviewResult {
  overlays: ChartOverlay[];
  signals: PreviewSignal[];
  fingerprint: string;
}

/** 最小 K 线接口（兼容 data-center 的 ExtendedBar / Bar） */
interface BarLike {
  timestamp: number;
  close: number;
}

// ─── PreviewService ────────────────────────────────────────────────────────

export class PreviewService {
  /**
   * 对 K 线数组计算策略预览叠加层和信号
   * @param bars  K 线数组（须含 timestamp / close）
   * @param params  策略参数（从 configSnapshot.params 或 preview_params 传入）
   */
  static computePreview(bars: BarLike[], params: Record<string, unknown>): PreviewResult {
    if (bars.length < 2) {
      return { overlays: [], signals: [], fingerprint: '' };
    }

    const closes = bars.map(b => b.close);
    const overlays: ChartOverlay[] = [];
    const signals: PreviewSignal[] = [];

    // ── 1. SMA 叠加层（从数值参数中提取周期） ──────────
    const periods = extractPeriodParams(params);
    for (const period of periods) {
      const sma = computeSMA(closes, period);
      overlays.push({
        name: `SMA(${period})`,
        type: 'line',
        data: zip(bars, sma),
      });
    }

    // ── 2. MACD 叠加层 + 信号（标准 12-26-9） ──────────
    const macd = computeMACD(closes, 12, 26, 9);
    if (macd) {
      overlays.push({ name: 'MACD_LINE', type: 'line', data: zip(bars, macd.macd) });
      overlays.push({ name: 'MACD_SIGNAL', type: 'line', data: zip(bars, macd.signal) });
      overlays.push({ name: 'MACD_HIST', type: 'bar', data: zip(bars, macd.histogram) });

      // 金叉/死叉检测
      for (let i = 1; i < macd.macd.length; i++) {
        const pm = macd.macd[i - 1], cm = macd.macd[i];
        const ps = macd.signal[i - 1], cs = macd.signal[i];
        if ([pm, cm, ps, cs].some(v => !Number.isFinite(v))) continue;

        if (pm <= ps && cm > cs) {
          signals.push({
            timestamp: bars[i].timestamp,
            side: 'buy',
            type: 'macd_golden_cross',
            reason: `MACD 金叉（快线${cm.toFixed(2)}上穿慢线${cs.toFixed(2)}）`,
          });
        } else if (pm >= ps && cm < cs) {
          signals.push({
            timestamp: bars[i].timestamp,
            side: 'sell',
            type: 'macd_death_cross',
            reason: `MACD 死叉（快线${cm.toFixed(2)}下穿慢线${cs.toFixed(2)}）`,
          });
        }
      }
    }

    // ── 3. RSI 叠加层 + 信号（周期 14） ────────────────
    const rsi = computeRSI(closes, 14);
    if (rsi) {
      overlays.push({ name: 'RSI(14)', type: 'line', data: zip(bars, rsi) });

      // 超买/超卖参考线
      overlays.push({ name: 'RSI_70', type: 'zone', data: bars.map(b => ({ timestamp: b.timestamp, value: 70 })) });
      overlays.push({ name: 'RSI_30', type: 'zone', data: bars.map(b => ({ timestamp: b.timestamp, value: 30 })) });

      // 超买超卖反转信号
      for (let i = 1; i < rsi.length; i++) {
        const pv = rsi[i - 1], cv = rsi[i];
        if (!Number.isFinite(pv) || !Number.isFinite(cv)) continue;

        if (pv < 30 && cv >= 30) {
          signals.push({
            timestamp: bars[i].timestamp,
            side: 'buy',
            type: 'rsi_oversold_reversal',
            reason: `RSI 从 ${pv.toFixed(1)} 升破 30（超卖反弹信号）`,
          });
        } else if (pv > 70 && cv <= 70) {
          signals.push({
            timestamp: bars[i].timestamp,
            side: 'sell',
            type: 'rsi_overbought_reversal',
            reason: `RSI 从 ${pv.toFixed(1)} 跌破 70（超买回落信号）`,
          });
        }
      }
    }

    // ── 4. 指纹 ────────────────────────────────────────
    const last10 = closes.slice(-10);
    const raw = JSON.stringify(params) + last10.join(',');
    const hash = createHash('sha256').update(raw, 'utf-8').digest('hex').substring(0, 16);
    const fingerprint = `sha256:${hash}`;

    return { overlays, signals, fingerprint };
  }
}

// ─── 提取数值参数（可用于计算周期） ───────────────────────────────────────

function extractPeriodParams(params: Record<string, unknown>): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const val of Object.values(params)) {
    const n = typeof val === 'number' ? val : Number(val);
    if (Number.isFinite(n) && n > 1 && n <= 500 && !seen.has(n)) {
      seen.add(n);
      out.push(Math.round(n));
    }
  }
  // 确保常用周期始终存在（即使参数中没有）
  if (!seen.has(20)) out.push(20);
  return out;
}

// ─── 技术指标函数 ──────────────────────────────────────────────────────────

/** 简单移动平均 */
function computeSMA(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += data[i - j];
    result[i] = sum / period;
  }
  return result;
}

/** 指数移动平均（支持输入含前导 NaN） */
function computeEMA(data: number[], period: number): number[] {
  const n = data.length;
  const result = new Array(n).fill(NaN);

  // 跳过前导 NaN
  let start = 0;
  while (start < n && isNaN(data[start])) start++;
  if (n - start < period) return result;

  // 初始 SMA
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[start + i];
  let ema = sum / period;
  result[start + period - 1] = ema;

  const k = 2 / (period + 1);
  for (let i = start + period; i < n; i++) {
    ema = data[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

/** MACD */
function computeMACD(
  data: number[],
  fastPeriod: number,
  slowPeriod: number,
  signalPeriod: number,
): { macd: number[]; signal: number[]; histogram: number[] } | null {
  if (data.length < slowPeriod + signalPeriod) return null;

  const emaFast = computeEMA(data, fastPeriod);
  const emaSlow = computeEMA(data, slowPeriod);

  const macdLine = new Array(data.length).fill(NaN);
  for (let i = 0; i < data.length; i++) {
    if (Number.isFinite(emaFast[i]) && Number.isFinite(emaSlow[i])) {
      macdLine[i] = emaFast[i] - emaSlow[i];
    }
  }

  const signal = computeEMA(macdLine, signalPeriod);

  const histogram = new Array(data.length).fill(NaN);
  for (let i = 0; i < data.length; i++) {
    if (Number.isFinite(macdLine[i]) && Number.isFinite(signal[i])) {
      histogram[i] = macdLine[i] - signal[i];
    }
  }

  return { macd: macdLine, signal, histogram };
}

/** RSI（Wilder 平滑法） */
function computeRSI(data: number[], period: number): number[] | null {
  if (data.length < period + 1) return null;

  const result = new Array(data.length).fill(NaN);

  // 初始平均涨跌幅
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = data[i] - data[i - 1];
    avgGain += Math.max(delta, 0);
    avgLoss += Math.max(-delta, 0);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder 平滑
  for (let i = period + 1; i < data.length; i++) {
    const delta = data[i] - data[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

// ─── 工具函数 ───────────────────────────────────────────────────────────────

/** 将 bars 时间戳与指标值配对，跳过 NaN */
function zip(bars: BarLike[], values: number[]): Array<{ timestamp: number; value: number }> {
  const out: Array<{ timestamp: number; value: number }> = [];
  for (let i = 0; i < bars.length; i++) {
    if (Number.isFinite(values[i])) {
      out.push({ timestamp: bars[i].timestamp, value: values[i] });
    }
  }
  return out;
}
