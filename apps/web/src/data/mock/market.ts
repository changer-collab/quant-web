// apps/web/src/data/mock/market.ts
import { TimeFrame } from '../types.js';

/** 生成模拟 K 线数据 */
export function generateMockBars(
  symbol: string,
  timeframe: TimeFrame,
  count: number = 100,
  basePrice: number = 50,
) {
  const bars = [];
  const now = Date.now();
  const intervalMs = getIntervalMs(timeframe);
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * intervalMs;
    const change = (Math.random() - 0.48) * basePrice * 0.03;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * basePrice * 0.01;
    const low = Math.min(open, close) - Math.random() * basePrice * 0.01;
    const volume = Math.floor(100000 + Math.random() * 500000);

    bars.push({
      symbol,
      timeframe,
      timestamp,
      open: round(open),
      high: round(high),
      low: round(low),
      close: round(close),
      volume,
      turnover: round(volume * (open + close) / 2),
      openInterest: undefined,
      numTrades: Math.floor(volume / 100),
    });

    price = close;
  }

  return bars;
}

/** 生成模拟 Tick 数据 */
export function generateMockTicks(
  symbol: string,
  count: number = 20,
  basePrice: number = 50,
) {
  const ticks = [];
  const now = Date.now();
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * 1000;
    const change = (Math.random() - 0.5) * basePrice * 0.001;
    price += change;

    ticks.push({
      symbol,
      timestamp,
      price: round(price),
      volume: Math.floor(100 + Math.random() * 5000),
      bid: round(price - 0.01),
      ask: round(price + 0.01),
      bidVolume: Math.floor(1000 + Math.random() * 10000),
      askVolume: Math.floor(1000 + Math.random() * 10000),
      bidOrders: Math.floor(1 + Math.random() * 20),
      askOrders: Math.floor(1 + Math.random() * 20),
    });
  }

  return ticks;
}

/** 获取时间周期对应的毫秒数 */
function getIntervalMs(timeframe: TimeFrame): number {
  switch (timeframe) {
    case TimeFrame.M1: return 60 * 1000;
    case TimeFrame.M5: return 5 * 60 * 1000;
    case TimeFrame.M15: return 15 * 60 * 1000;
    case TimeFrame.H1: return 60 * 60 * 1000;
    case TimeFrame.D1: return 24 * 60 * 60 * 1000;
    default: return 60 * 1000;
  }
}

function round(n: number, decimals: number = 2): number {
  return Number(n.toFixed(decimals));
}

/** 预生成的 Mock 数据集 */
export const MOCK_BARS_DAILY = generateMockBars('600519.SH', TimeFrame.D1, 60, 1800);
export const MOCK_BARS_HOURLY = generateMockBars('600519.SH', TimeFrame.H1, 40, 1800);
export const MOCK_TICKS_RECENT = generateMockTicks('600519.SH', 20, 1800);