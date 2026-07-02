// apps/web/src/data/mock/index.ts
export {
  MOCK_INSTRUMENTS,
  MOCK_TRADING_CALENDAR_2025_SSE,
  MOCK_INDEX_COMPOSITION_CSI500,
  MOCK_ADJUSTMENT_FACTORS,
} from './reference';

export {
  generateMockBars,
  generateMockTicks,
  MOCK_BARS_DAILY,
  MOCK_BARS_HOURLY,
  MOCK_TICKS_RECENT,
} from './market';

export {
  generateMockSnapshot,
  generateMockTradeRecords,
  generateMockOrderRecords,
  MOCK_SNAPSHOT,
  MOCK_TRADE_RECORDS,
  MOCK_ORDER_RECORDS,
} from './l2';

export {
  MOCK_FINANCIAL_REPORTS,
  MOCK_FINANCIAL_RATIOS,
  MOCK_VALUATION_SERIES,
  MOCK_SHAREHOLDER_METRICS,
} from './fundamental';

export {
  MOCK_ANNOUNCEMENT_EVENTS,
  MOCK_NEWS_ARTICLES,
  MOCK_SENTIMENT_SERIES,
  MOCK_MACRO_INDICATORS,
  MOCK_MACRO_POINTS,
} from './event';

export { MOCK_REPORT } from './report';
