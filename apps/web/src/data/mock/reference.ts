// apps/web/src/data/mock/reference.ts
import {
  InstrumentStatus,
  AdjustmentType,
} from '../types.js';

/** Mock 标的列表 */
export const MOCK_INSTRUMENTS = [
  {
    symbol: '000001.SZ',
    name: '平安银行',
    exchange: 'SZSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '银行',
    sector: '金融',
    listDate: Date.UTC(1991, 3, 3),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '600519.SH',
    name: '贵州茅台',
    exchange: 'SSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '白酒',
    sector: '消费',
    listDate: Date.UTC(2001, 7, 27),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '000858.SZ',
    name: '五粮液',
    exchange: 'SZSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '白酒',
    sector: '消费',
    listDate: Date.UTC(1998, 3, 27),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '300750.SZ',
    name: '宁德时代',
    exchange: 'SZSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '电池',
    sector: '新能源',
    listDate: Date.UTC(2018, 5, 11),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '601318.SH',
    name: '中国平安',
    exchange: 'SSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '保险',
    sector: '金融',
    listDate: Date.UTC(2007, 2, 1),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '000333.SZ',
    name: '美的集团',
    exchange: 'SZSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '家电',
    sector: '消费',
    listDate: Date.UTC(2013, 8, 18),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '002415.SZ',
    name: '海康威视',
    exchange: 'SZSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '安防',
    sector: '科技',
    listDate: Date.UTC(2010, 4, 28),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '600036.SH',
    name: '招商银行',
    exchange: 'SSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '银行',
    sector: '金融',
    listDate: Date.UTC(2002, 3, 9),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '600276.SH',
    name: '恒瑞医药',
    exchange: 'SSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '医药',
    sector: '医药',
    listDate: Date.UTC(2000, 9, 18),
    status: InstrumentStatus.Active,
  },
  {
    symbol: '000651.SZ',
    name: '格力电器',
    exchange: 'SZSE',
    lotSize: 100,
    priceTick: 0.01,
    industry: '家电',
    sector: '消费',
    listDate: Date.UTC(1996, 10, 18),
    status: InstrumentStatus.Active,
  },
];

/** Mock 交易日历（2025年，SSE） */
export const MOCK_TRADING_CALENDAR_2025_SSE = {
  exchange: 'SSE',
  year: 2025,
  tradingDays: generateTradingDays(2025),
  holidays: [],
  sessionType: 'regular',
};

/** Mock 指数成分（CSI 500 样本） */
export const MOCK_INDEX_COMPOSITION_CSI500 = {
  indexSymbol: '000905.SH',
  asOfDate: Date.UTC(2025, 5, 15),
  constituents: [
    { symbol: '000001.SZ', weight: 0.015 },
    { symbol: '000333.SZ', weight: 0.020 },
    { symbol: '002415.SZ', weight: 0.018 },
    { symbol: '300750.SZ', weight: 0.025 },
    { symbol: '600276.SH', weight: 0.022 },
    { symbol: '000651.SZ', weight: 0.016 },
    { symbol: '000858.SZ', weight: 0.019 },
    { symbol: '600036.SH', weight: 0.021 },
  ],
};

/** Mock 复权因子 */
export const MOCK_ADJUSTMENT_FACTORS = [
  { symbol: '600519.SH', date: Date.UTC(2025, 5, 10), factor: 1.0, type: AdjustmentType.Forward },
  { symbol: '600519.SH', date: Date.UTC(2025, 5, 11), factor: 1.0, type: AdjustmentType.Forward },
  { symbol: '600519.SH', date: Date.UTC(2025, 5, 12), factor: 1.0, type: AdjustmentType.Forward },
];

// ─── 辅助函数 ───────────────────────────────────────────

/** 生成一年中所有交易日（简化：周一至周五除去 1/1、5/1、10/1） */
function generateTradingDays(year: number): number[] {
  const days: number[] = [];
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const holidays = new Set([
    `${year}-01-01`, `${year}-05-01`, `${year}-10-01`,
    `${year}-10-02`, `${year}-10-03`,
  ]);

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayOfWeek = d.getUTCDay();
    const dateStr = d.toISOString().slice(0, 10);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidays.has(dateStr)) {
      days.push(d.getTime());
    }
  }
  return days;
}