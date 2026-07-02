// apps/web/src/data/mock/l2.ts
import { TradeSide, TradeType, OrderAction, L2OrderType } from '../types.js';

/** 生成模拟盘口快照 */
export function generateMockSnapshot(symbol: string, basePrice: number = 50) {
  return {
    symbol,
    timestamp: Date.now(),
    bids: Array.from({ length: 5 }, (_, i) => ({
      price: round(basePrice - 0.01 * (i + 1)),
      volume: Math.floor(1000 + Math.random() * 5000),
      orderCount: Math.floor(5 + Math.random() * 30),
    })),
    asks: Array.from({ length: 5 }, (_, i) => ({
      price: round(basePrice + 0.01 * (i + 1)),
      volume: Math.floor(1000 + Math.random() * 5000),
      orderCount: Math.floor(5 + Math.random() * 30),
    })),
  };
}

/** 生成模拟逐笔成交 */
export function generateMockTradeRecords(symbol: string, count: number = 20) {
  const records = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    records.push({
      symbol,
      timestamp: now - (count - i) * 500,
      price: round(50 + (Math.random() - 0.5) * 0.2),
      volume: Math.floor(100 + Math.random() * 2000),
      side: Math.random() > 0.5 ? TradeSide.Buy : TradeSide.Sell,
      tradeType: Math.random() > 0.8 ? TradeType.Block : TradeType.Normal,
    });
  }
  return records;
}

/** 生成模拟逐笔委托 */
export function generateMockOrderRecords(symbol: string, count: number = 20) {
  const records = [];
  const now = Date.now();
  for (let i = 0; i < count; i++) {
    records.push({
      symbol,
      timestamp: now - (count - i) * 500,
      price: round(50 + (Math.random() - 0.5) * 0.3),
      volume: Math.floor(100 + Math.random() * 3000),
      action: Math.random() > 0.3 ? OrderAction.Add : OrderAction.Cancel,
      orderType: L2OrderType.Limit,
    });
  }
  return records;
}

function round(n: number, decimals: number = 2): number {
  return Number(n.toFixed(decimals));
}

/** 预生成数据集 */
export const MOCK_SNAPSHOT = generateMockSnapshot('600519.SH', 1800);
export const MOCK_TRADE_RECORDS = generateMockTradeRecords('600519.SH', 20);
export const MOCK_ORDER_RECORDS = generateMockOrderRecords('600519.SH', 20);
