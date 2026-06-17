// apps/web/tests/data-mock.test.ts
import { describe, it, expect } from 'vitest';
import {
  MOCK_INSTRUMENTS,
  MOCK_TRADING_CALENDAR_2025_SSE,
  MOCK_INDEX_COMPOSITION_CSI500,
  MOCK_BARS_DAILY,
  MOCK_BARS_HOURLY,
  MOCK_TICKS_RECENT,
  generateMockBars,
  generateMockTicks,
  generateMockSnapshot,
  generateMockTradeRecords,
  generateMockOrderRecords,
  MOCK_FINANCIAL_REPORTS,
  MOCK_FINANCIAL_RATIOS,
  MOCK_VALUATION_SERIES,
  MOCK_ANNOUNCEMENT_EVENTS,
  MOCK_NEWS_ARTICLES,
  MOCK_SENTIMENT_SERIES,
  MOCK_MACRO_INDICATORS,
  MOCK_MACRO_POINTS,
} from '../src/data/mock';
import { TimeFrame } from '../src/data/types';

describe('reference mock', () => {
  it('MOCK_INSTRUMENTS 包含至少 5 个标的', () => {
    expect(MOCK_INSTRUMENTS.length).toBeGreaterThanOrEqual(5);
  });

  it('每个标的都有必需字段', () => {
    MOCK_INSTRUMENTS.forEach((inst) => {
      expect(inst.symbol).toBeTruthy();
      expect(inst.name).toBeTruthy();
      expect(inst.exchange).toBeTruthy();
      expect(inst.lotSize).toBeGreaterThan(0);
      expect(inst.priceTick).toBeGreaterThan(0);
      expect(inst.industry).toBeTruthy();
      expect(inst.sector).toBeTruthy();
      expect(inst.status).toBeDefined();
    });
  });

  it('symbol 格式正确（xxxxxx.XX）', () => {
    MOCK_INSTRUMENTS.forEach((inst) => {
      expect(inst.symbol).toMatch(/^\d{6}\.(SZ|SH)$/);
    });
  });

  it('交易日历包含 2025 年交易日', () => {
    expect(MOCK_TRADING_CALENDAR_2025_SSE.exchange).toBe('SSE');
    expect(MOCK_TRADING_CALENDAR_2025_SSE.year).toBe(2025);
    expect(MOCK_TRADING_CALENDAR_2025_SSE.tradingDays.length).toBeGreaterThan(200);
  });

  it('指数成分总权重约等于 1', () => {
    const totalWeight = MOCK_INDEX_COMPOSITION_CSI500.constituents.reduce(
      (sum, c) => sum + c.weight,
      0,
    );
    expect(totalWeight).toBeLessThan(1.1);
    expect(totalWeight).toBeGreaterThan(0);
  });
});

describe('market mock', () => {
  it('generateMockBars 生成指定数量的 K 线', () => {
    const bars = generateMockBars('600519.SH', TimeFrame.D1, 50, 100);
    expect(bars.length).toBe(50);
  });

  it('K 线 open/high/low/close 合理', () => {
    const bars = generateMockBars('600519.SH', TimeFrame.D1, 20, 100);
    bars.forEach((bar) => {
      expect(bar.high).toBeGreaterThanOrEqual(bar.low);
      expect(bar.high).toBeGreaterThanOrEqual(bar.open);
      expect(bar.high).toBeGreaterThanOrEqual(bar.close);
      expect(bar.low).toBeLessThanOrEqual(bar.open);
      expect(bar.low).toBeLessThanOrEqual(bar.close);
      expect(bar.volume).toBeGreaterThan(0);
    });
  });

  it('generateMockTicks 生成指定数量的 Tick', () => {
    const ticks = generateMockTicks('600519.SH', 15, 50);
    expect(ticks.length).toBe(15);
  });

  it('Tick 价格合理', () => {
    const ticks = generateMockTicks('600519.SH', 10, 50);
    ticks.forEach((tick) => {
      expect(tick.bid).toBeLessThanOrEqual(tick.ask);
      expect(tick.volume).toBeGreaterThan(0);
      expect(tick.bidVolume).toBeGreaterThan(0);
      expect(tick.askVolume).toBeGreaterThan(0);
    });
  });

  it('预生成数据非空', () => {
    expect(MOCK_BARS_DAILY.length).toBeGreaterThan(0);
    expect(MOCK_BARS_HOURLY.length).toBeGreaterThan(0);
    expect(MOCK_TICKS_RECENT.length).toBeGreaterThan(0);
  });
});

describe('l2 mock', () => {
  it('generateMockSnapshot 生成盘口快照', () => {
    const snapshot = generateMockSnapshot('600519.SH', 1800);
    expect(snapshot.symbol).toBe('600519.SH');
    expect(snapshot.bids.length).toBe(5);
    expect(snapshot.asks.length).toBe(5);
    // 买盘按价格降序
    for (let i = 1; i < snapshot.bids.length; i++) {
      expect(snapshot.bids[i - 1].price).toBeGreaterThan(snapshot.bids[i].price);
    }
    // 卖盘按价格升序
    for (let i = 1; i < snapshot.asks.length; i++) {
      expect(snapshot.asks[i - 1].price).toBeLessThan(snapshot.asks[i].price);
    }
  });

  it('generateMockTradeRecords 生成逐笔成交', () => {
    const records = generateMockTradeRecords('600519.SH', 10);
    expect(records.length).toBe(10);
    records.forEach((r) => {
      expect(r.symbol).toBe('600519.SH');
      expect(r.price).toBeGreaterThan(0);
      expect(r.volume).toBeGreaterThan(0);
      expect(r.side).toBeDefined();
      expect(r.tradeType).toBeDefined();
    });
  });

  it('generateMockOrderRecords 生成逐笔委托', () => {
    const records = generateMockOrderRecords('600519.SH', 10);
    expect(records.length).toBe(10);
    records.forEach((r) => {
      expect(r.symbol).toBe('600519.SH');
      expect(r.action).toBeDefined();
      expect(r.orderType).toBeDefined();
    });
  });
});

describe('fundamental mock', () => {
  it('MOCK_FINANCIAL_REPORTS 包含财务报告', () => {
    expect(MOCK_FINANCIAL_REPORTS.length).toBeGreaterThanOrEqual(2);
    MOCK_FINANCIAL_REPORTS.forEach((report) => {
      expect(report.symbol).toBeTruthy();
      expect(report.reportDate).toBeGreaterThan(0);
      expect(report.announceDate).toBeGreaterThan(0);
      expect(report.reportType).toBeDefined();
      expect(report.income.revenue).toBeGreaterThan(0);
      expect(report.income.netIncome).toBeDefined();
      expect(report.balanceSheet.totalAssets).toBeGreaterThan(0);
      expect(report.cashFlow.operatingCashFlow).toBeDefined();
    });
  });

  it('MOCK_FINANCIAL_RATIOS 包含财务比率', () => {
    expect(MOCK_FINANCIAL_RATIOS.length).toBeGreaterThanOrEqual(2);
    MOCK_FINANCIAL_RATIOS.forEach((ratio) => {
      expect(ratio.roe).toBeGreaterThan(0);
      expect(ratio.roe).toBeLessThan(1);
      expect(ratio.grossMargin).toBeGreaterThan(0);
      expect(ratio.grossMargin).toBeLessThan(1);
    });
  });

  it('估值序列数据递增', () => {
    for (let i = 1; i < MOCK_VALUATION_SERIES.length; i++) {
      expect(MOCK_VALUATION_SERIES[i].timestamp).toBeGreaterThan(
        MOCK_VALUATION_SERIES[i - 1].timestamp,
      );
    }
  });
});

describe('event mock', () => {
  it('MOCK_ANNOUNCEMENT_EVENTS 包含公告', () => {
    expect(MOCK_ANNOUNCEMENT_EVENTS.length).toBeGreaterThanOrEqual(3);
    MOCK_ANNOUNCEMENT_EVENTS.forEach((evt) => {
      expect(evt.id).toBeTruthy();
      expect(evt.symbol).toBeTruthy();
      expect(evt.eventTime).toBeGreaterThan(0);
      expect(evt.eventType).toBeDefined();
      expect(evt.title).toBeTruthy();
    });
  });

  it('MOCK_NEWS_ARTICLES 包含新闻', () => {
    expect(MOCK_NEWS_ARTICLES.length).toBeGreaterThanOrEqual(3);
    MOCK_NEWS_ARTICLES.forEach((news) => {
      expect(news.id).toBeTruthy();
      expect(news.title).toBeTruthy();
      expect(news.source).toBeTruthy();
      expect(news.symbols.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('情绪分数在 -1 到 1 之间', () => {
    MOCK_SENTIMENT_SERIES.forEach((sp) => {
      expect(sp.score).toBeGreaterThanOrEqual(-1);
      expect(sp.score).toBeLessThanOrEqual(1);
      expect(sp.sampleSize).toBeGreaterThan(0);
    });
  });

  it('宏观指标定义完整', () => {
    expect(MOCK_MACRO_INDICATORS.length).toBeGreaterThanOrEqual(4);
    MOCK_MACRO_INDICATORS.forEach((ind) => {
      expect(ind.id).toBeTruthy();
      expect(ind.name).toBeTruthy();
      expect(ind.frequency).toBeDefined();
      expect(ind.source).toBeTruthy();
    });
  });

  it('宏观数据点引用有效的指标', () => {
    const knownIds = new Set(MOCK_MACRO_INDICATORS.map((i) => i.id));
    MOCK_MACRO_POINTS.forEach((point) => {
      expect(knownIds.has(point.indicatorId)).toBe(true);
      expect(point.timestamp).toBeGreaterThan(0);
    });
  });
});