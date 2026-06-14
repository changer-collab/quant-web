import { describe, it, expect } from 'vitest';
import { DataCleaner } from '../src/cleaner.js';
import { TimeFrame, ReportType, AdjustmentType, AnnouncementEventType, EventImpact } from '@quant/data-center';
import type { RawDataRecord } from '../src/adapters/types.js';

describe('DataCleaner', () => {
  it('清洗 bar 原始记录为 ExtendedBar', () => {
    const raw: RawDataRecord = {
      symbol: 'CSI500',
      timestamp: '1700000000000',
      open: '5000',
      high: '5100',
      low: '4900',
      close: '5050',
      volume: '100000',
      turnover: '500000000',
    };
    const bar = DataCleaner.cleanBar(raw, TimeFrame.D1);
    expect(bar.symbol).toBe('CSI500');
    expect(bar.timestamp).toBe(1700000000000);
    expect(bar.close).toBe(5050);
    expect(bar.timeframe).toBe(TimeFrame.D1);
  });

  it('清洗 bar 缺少必填字段时抛错', () => {
    const raw: RawDataRecord = { symbol: 'CSI500' };
    expect(() => DataCleaner.cleanBar(raw, TimeFrame.D1)).toThrow();
  });

  it('清洗 instrument 原始记录为 ExtendedInstrument', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      name: '贵州茅台',
      exchange: 'SSE',
      lotSize: '100',
      priceTick: '0.01',
      industry: '白酒',
      sector: '消费',
      listDate: '996220800000',
      status: 'active',
    };
    const inst = DataCleaner.cleanInstrument(raw);
    expect(inst.symbol).toBe('600519');
    expect(inst.lotSize).toBe(100);
    expect(inst.listDate).toBe(996220800000);
    expect(inst.status).toBe('active');
  });

  it('清洗 instrument 的 listDate 支持 YYYYMMDD 格式自动转换', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      name: '贵州茅台',
      exchange: 'SSE',
      lotSize: '100',
      priceTick: '0.01',
      industry: '白酒',
      sector: '消费',
      listDate: '20010827',
      status: 'active',
    };
    const inst = DataCleaner.cleanInstrument(raw);
    expect(inst.listDate).toBe(998870400000);  // 2001-08-27 00:00:00 UTC
  });

  it('清洗 instrument 缺少必填字段时抛错', () => {
    const raw: RawDataRecord = { symbol: '600519' };
    expect(() => DataCleaner.cleanInstrument(raw)).toThrow();
  });

  it('批量清洗 bar', () => {
    const raws: RawDataRecord[] = [
      { symbol: 'CSI500', timestamp: '1000', open: '5000', high: '5100', low: '4900', close: '5050', volume: '100000', turnover: '500000000' },
      { symbol: 'CSI500', timestamp: '2000', open: '5050', high: '5200', low: '5000', close: '5150', volume: '120000', turnover: '600000000' },
    ];
    const bars = DataCleaner.cleanBars(raws, TimeFrame.D1);
    expect(bars).toHaveLength(2);
    expect(bars[0].close).toBe(5050);
  });

  // ─── financialReport 清洗 ────────────────────────────────

  it('清洗 financialReport 原始记录', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      reportDate: '1703980800000',
      announceDate: '1706620800000',
      reportType: 'annual',
      revenue: '1000000000',
      costOfRevenue: '500000000',
      operatingIncome: '400000000',
      totalRevenue: '450000000',
      netIncome: '350000000',
      totalAssets: '20000000000',
      totalLiabilities: '8000000000',
      totalEquity: '12000000000',
      currentAssets: '5000000000',
      currentLiabilities: '3000000000',
      operatingCashFlow: '400000000',
      investingCashFlow: '-100000000',
      financingCashFlow: '-150000000',
      freeCashFlow: '300000000',
    };
    const report = DataCleaner.cleanFinancialReport(raw);
    expect(report.symbol).toBe('600519');
    expect(report.reportType).toBe(ReportType.Annual);
    expect(report.income.revenue).toBe(1000000000);
    expect(report.income.netIncome).toBe(350000000);
    expect(report.balanceSheet.totalAssets).toBe(20000000000);
    expect(report.cashFlow.operatingCashFlow).toBe(400000000);
  });

  it('清洗 financialReport 支持 q1/q2/q3 报告期类型', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      reportDate: '1711929600000',
      announceDate: '1714560000000',
      reportType: 'q1',
      revenue: '200000000',
      costOfRevenue: '100000000',
      operatingIncome: '80000000',
      totalRevenue: '90000000',
      netIncome: '70000000',
      totalAssets: '20000000000',
      totalLiabilities: '8000000000',
      totalEquity: '12000000000',
      currentAssets: '5000000000',
      currentLiabilities: '3000000000',
      operatingCashFlow: '100000000',
      investingCashFlow: '-30000000',
      financingCashFlow: '-40000000',
      freeCashFlow: '70000000',
    };
    const report = DataCleaner.cleanFinancialReport(raw);
    expect(report.reportType).toBe(ReportType.Q1);
  });

  it('批量清洗 financialReport', () => {
    const raws: RawDataRecord[] = [
      { symbol: '600519', reportDate: '1703980800000', announceDate: '1706620800000', reportType: 'annual', revenue: '1', costOfRevenue: '1', operatingIncome: '1', totalRevenue: '1', netIncome: '1', totalAssets: '1', totalLiabilities: '1', totalEquity: '1', currentAssets: '1', currentLiabilities: '1', operatingCashFlow: '1', investingCashFlow: '1', financingCashFlow: '1', freeCashFlow: '1' },
      { symbol: '600519', reportDate: '1711929600000', announceDate: '1714560000000', reportType: 'q1', revenue: '2', costOfRevenue: '2', operatingIncome: '2', totalRevenue: '2', netIncome: '2', totalAssets: '2', totalLiabilities: '2', totalEquity: '2', currentAssets: '2', currentLiabilities: '2', operatingCashFlow: '2', investingCashFlow: '2', financingCashFlow: '2', freeCashFlow: '2' },
    ];
    const reports = DataCleaner.cleanFinancialReports(raws);
    expect(reports).toHaveLength(2);
    expect(reports[0].reportType).toBe(ReportType.Annual);
    expect(reports[1].reportType).toBe(ReportType.Q1);
  });

  // ─── adjustmentFactor 清洗 ────────────────────────────────

  it('清洗 adjustmentFactor 原始记录', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      date: '20230601',
      factor: '1.05',
      type: 'forward',
    };
    const factor = DataCleaner.cleanAdjustmentFactor(raw);
    expect(factor.symbol).toBe('600519');
    expect(factor.factor).toBe(1.05);
    expect(factor.type).toBe(AdjustmentType.Forward);
  });

  it('清洗 adjustmentFactor 支持 hfq 类型', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      date: '20230601',
      factor: '1.05',
      type: 'hfq',
    };
    const factor = DataCleaner.cleanAdjustmentFactor(raw);
    expect(factor.type).toBe(AdjustmentType.Forward);
  });

  it('批量清洗 adjustmentFactor', () => {
    const raws: RawDataRecord[] = [
      { symbol: '600519', date: '20230101', factor: '1.0', type: 'forward' },
      { symbol: '600519', date: '20230601', factor: '1.05', type: 'forward' },
    ];
    const factors = DataCleaner.cleanAdjustmentFactors(raws);
    expect(factors).toHaveLength(2);
    expect(factors[1].factor).toBe(1.05);
  });

  // ─── tradingCalendar 清洗 ────────────────────────────────

  it('清洗 tradingCalendar（逗号分隔 YYYYMMDD）', () => {
    const raw: RawDataRecord = {
      exchange: 'SSE',
      year: '2024',
      tradingDays: '20240102,20240103,20240104',
      holidays: '20240101',
    };
    const cal = DataCleaner.cleanTradingCalendar(raw);
    expect(cal.exchange).toBe('SSE');
    expect(cal.year).toBe(2024);
    expect(cal.tradingDays).toHaveLength(3);
    expect(cal.holidays).toHaveLength(1);
  });

  it('清洗 tradingCalendar（JSON 数组格式）', () => {
    const raw: RawDataRecord = {
      exchange: 'SSE',
      year: '2024',
      tradingDays: '["20240102","20240103"]',
      holidays: '["20240101"]',
    };
    const cal = DataCleaner.cleanTradingCalendar(raw);
    expect(cal.tradingDays).toHaveLength(2);
    expect(cal.holidays).toHaveLength(1);
  });

  // ─── announcementEvent 清洗 ────────────────────────────────

  it('清洗 announcementEvent 原始记录', () => {
    const raw: RawDataRecord = {
      id: 'evt-001',
      symbol: '600519',
      eventTime: '1703980800000',
      eventType: 'dividend',
      title: '分红公告',
      description: '每10股派发现金红利200元',
      impact: 'positive',
    };
    const evt = DataCleaner.cleanAnnouncementEvent(raw);
    expect(evt.id).toBe('evt-001');
    expect(evt.symbol).toBe('600519');
    expect(evt.eventType).toBe(AnnouncementEventType.Dividend);
    expect(evt.impact).toBe(EventImpact.Positive);
    expect(evt.description).toBe('每10股派发现金红利200元');
  });

  it('清洗 announcementEvent 缺少 description 时可选', () => {
    const raw: RawDataRecord = {
      id: 'evt-002',
      symbol: '600519',
      eventTime: '1703980800000',
      eventType: 'st',
      title: 'ST公告',
      impact: 'negative',
    };
    const evt = DataCleaner.cleanAnnouncementEvent(raw);
    expect(evt.description).toBeUndefined();
    expect(evt.impact).toBe(EventImpact.Negative);
  });

  it('批量清洗 announcementEvent', () => {
    const raws: RawDataRecord[] = [
      { id: '1', symbol: '600519', eventTime: '1000', eventType: 'dividend', title: '分红', impact: 'positive' },
      { id: '2', symbol: '000001', eventTime: '2000', eventType: 'ipo', title: 'IPO', impact: 'neutral' },
    ];
    const events = DataCleaner.cleanAnnouncementEvents(raws);
    expect(events).toHaveLength(2);
  });

  // ─── newsArticle 清洗 ────────────────────────────────

  it('清洗 newsArticle 原始记录', () => {
    const raw: RawDataRecord = {
      id: 'news-001',
      publishTime: '1703980800000',
      title: '贵州茅台年报发布',
      source: '东方财富',
      symbols: '600519,000858',
      sentimentScore: '0.8',
      tags: '白酒,年报',
    };
    const article = DataCleaner.cleanNewsArticle(raw);
    expect(article.id).toBe('news-001');
    expect(article.title).toBe('贵州茅台年报发布');
    expect(article.symbols).toEqual(['600519', '000858']);
    expect(article.tags).toEqual(['白酒', '年报']);
    expect(article.sentimentScore).toBe(0.8);
  });

  it('清洗 newsArticle 的 symbols 支持 JSON 数组', () => {
    const raw: RawDataRecord = {
      id: 'news-002',
      publishTime: '1703980800000',
      title: '测试新闻',
      source: '测试',
      symbols: '["600519","000858"]',
      tags: '["白酒"]',
    };
    const article = DataCleaner.cleanNewsArticle(raw);
    expect(article.symbols).toEqual(['600519', '000858']);
    expect(article.tags).toEqual(['白酒']);
  });

  it('批量清洗 newsArticle', () => {
    const raws: RawDataRecord[] = [
      { id: '1', publishTime: '1000', title: '新闻1', source: '源1', symbols: '600519', tags: '白酒' },
      { id: '2', publishTime: '2000', title: '新闻2', source: '源2', symbols: '000001', tags: '银行' },
    ];
    const articles = DataCleaner.cleanNewsArticles(raws);
    expect(articles).toHaveLength(2);
  });

  // ─── tick 清洗 ────────────────────────────────

  it('清洗 tick 原始记录为 ExtendedTick', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      timestamp: '1700000000000',
      price: '1800.50',
      volume: '100',
      bid: '1800.00',
      ask: '1801.00',
      bidVolume: '50',
      askVolume: '60',
    };
    const tick = DataCleaner.cleanTick(raw);
    expect(tick.symbol).toBe('600519');
    expect(tick.price).toBe(1800.50);
    expect(tick.bid).toBe(1800.00);
    expect(tick.ask).toBe(1801.00);
    expect(tick.bidVolume).toBe(50);
    expect(tick.askVolume).toBe(60);
    expect(tick.bidOrders).toBeUndefined();
    expect(tick.askOrders).toBeUndefined();
  });

  it('清洗 tick 包含可选字段 bidOrders/askOrders', () => {
    const raw: RawDataRecord = {
      symbol: '600519',
      timestamp: '1700000000000',
      price: '1800.50',
      volume: '100',
      bid: '1800.00',
      ask: '1801.00',
      bidVolume: '50',
      askVolume: '60',
      bidOrders: '5',
      askOrders: '6',
    };
    const tick = DataCleaner.cleanTick(raw);
    expect(tick.bidOrders).toBe(5);
    expect(tick.askOrders).toBe(6);
  });

  it('批量清洗 tick', () => {
    const raws: RawDataRecord[] = [
      { symbol: '600519', timestamp: '1000', price: '1800', volume: '10', bid: '1799', ask: '1801', bidVolume: '5', askVolume: '5' },
      { symbol: '600519', timestamp: '2000', price: '1801', volume: '20', bid: '1800', ask: '1802', bidVolume: '10', askVolume: '10' },
    ];
    const ticks = DataCleaner.cleanTicks(raws);
    expect(ticks).toHaveLength(2);
    expect(ticks[1].price).toBe(1801);
  });

  // ─── dateFormat 显式模式 ────────────────────────────────

  it('parseDateField yyyymmdd 模式强制解析 YYYYMMDD', () => {
    DataCleaner.dateFormat = 'yyyymmdd';
    try {
      const raw: RawDataRecord = {
        symbol: '600519', name: '茅台', exchange: 'SSE', lotSize: '100', priceTick: '0.01',
        industry: '白酒', sector: '消费', listDate: '20010827', status: 'active',
      };
      const inst = DataCleaner.cleanInstrument(raw);
      expect(inst.listDate).toBe(998870400000);
    } finally {
      DataCleaner.dateFormat = 'auto';
    }
  });

  it('parseDateField timestamp 模式强制解析毫秒时间戳', () => {
    DataCleaner.dateFormat = 'timestamp';
    try {
      const raw: RawDataRecord = {
        symbol: '600519', name: '茅台', exchange: 'SSE', lotSize: '100', priceTick: '0.01',
        industry: '白酒', sector: '消费', listDate: '998870400000', status: 'active',
      };
      const inst = DataCleaner.cleanInstrument(raw);
      expect(inst.listDate).toBe(998870400000);
    } finally {
      DataCleaner.dateFormat = 'auto';
    }
  });

  it('parseDateField yyyymmdd 模式对非 YYYYMMDD 格式抛错', () => {
    DataCleaner.dateFormat = 'yyyymmdd';
    try {
      const raw: RawDataRecord = {
        symbol: '600519', name: '茅台', exchange: 'SSE', lotSize: '100', priceTick: '0.01',
        industry: '白酒', sector: '消费', listDate: '998870400000', status: 'active',
      };
      expect(() => DataCleaner.cleanInstrument(raw)).toThrow('不符合 YYYYMMDD 格式');
    } finally {
      DataCleaner.dateFormat = 'auto';
    }
  });
});
