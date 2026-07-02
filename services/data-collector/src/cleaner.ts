import {
  TimeFrame,
  ReportType,
  AnnouncementEventType,
  EventImpact,
  AdjustmentType,
} from '@quant/data-center';
import type {
  ExtendedBar,
  ExtendedTick,
  ExtendedInstrument,
  FinancialReport,
  AdjustmentFactor,
  TradingCalendar,
  AnnouncementEvent,
  NewsArticle,
  ShareholderMetrics,
} from '@quant/data-center';
import type { RawDataRecord } from './adapters/types.js';

/**
 * 数据清洗器 — 将适配器返回的原始键值对转为数据中心标准类型
 *
 * CSV 等文本源返回的字段值都是字符串，需要类型转换和校验。
 *
 * 日期解析策略：
 * - dateFormat='auto'（默认）：启发式判断 YYYYMMDD vs 毫秒时间戳
 * - dateFormat='yyyymmdd'：强制按 YYYYMMDD 解析，避免 8 位时间戳被误判
 * - dateFormat='timestamp'：强制按毫秒时间戳解析，避免 YYYYMMDD 被误判
 */
export class DataCleaner {
  /** 当前日期解析格式，影响所有 parseDateField 调用 */
  static dateFormat: 'auto' | 'yyyymmdd' | 'timestamp' = 'auto';
  /** 清洗单条 bar 记录 */
  static cleanBar(raw: RawDataRecord, timeframe: TimeFrame): ExtendedBar {
    const symbol = DataCleaner.requireString(raw, 'symbol');
    const timestamp = DataCleaner.requireNumber(raw, 'timestamp');
    const open = DataCleaner.requireNumber(raw, 'open');
    const high = DataCleaner.requireNumber(raw, 'high');
    const low = DataCleaner.requireNumber(raw, 'low');
    const close = DataCleaner.requireNumber(raw, 'close');
    const volume = DataCleaner.requireNumber(raw, 'volume');
    const turnover = DataCleaner.requireNumber(raw, 'turnover');

    return {
      symbol,
      timeframe,
      timestamp,
      open,
      high,
      low,
      close,
      volume,
      turnover,
      ...(raw.openInterest != null && { openInterest: Number(raw.openInterest) || undefined }),
      ...(raw.numTrades != null && { numTrades: Number(raw.numTrades) || undefined }),
    };
  }

  /** 批量清洗 bar */
  static cleanBars(raws: RawDataRecord[], timeframe: TimeFrame): ExtendedBar[] {
    return raws.map((r) => DataCleaner.cleanBar(r, timeframe));
  }

  /** 清洗单条 tick 记录 */
  static cleanTick(raw: RawDataRecord): ExtendedTick {
    return {
      symbol: DataCleaner.requireString(raw, 'symbol'),
      timestamp: DataCleaner.requireNumber(raw, 'timestamp'),
      price: DataCleaner.requireNumber(raw, 'price'),
      volume: DataCleaner.requireNumber(raw, 'volume'),
      bid: DataCleaner.requireNumber(raw, 'bid'),
      ask: DataCleaner.requireNumber(raw, 'ask'),
      bidVolume: DataCleaner.requireNumber(raw, 'bidVolume'),
      askVolume: DataCleaner.requireNumber(raw, 'askVolume'),
      ...(raw.bidOrders != null && { bidOrders: Number(raw.bidOrders) || undefined }),
      ...(raw.askOrders != null && { askOrders: Number(raw.askOrders) || undefined }),
    };
  }

  /** 批量清洗 tick */
  static cleanTicks(raws: RawDataRecord[]): ExtendedTick[] {
    return raws.map((r) => DataCleaner.cleanTick(r));
  }

  /** 清洗单条 instrument 记录 */
  static cleanInstrument(raw: RawDataRecord): ExtendedInstrument {
    return {
      symbol: DataCleaner.requireString(raw, 'symbol'),
      name: DataCleaner.requireString(raw, 'name'),
      exchange: DataCleaner.requireString(raw, 'exchange'),
      lotSize: DataCleaner.requireNumber(raw, 'lotSize'),
      priceTick: DataCleaner.requireNumber(raw, 'priceTick'),
      industry: DataCleaner.requireString(raw, 'industry'),
      sector: DataCleaner.requireString(raw, 'sector'),
      listDate: DataCleaner.parseDateField(raw, 'listDate'),
      ...(raw.delistDate != null && { delistDate: DataCleaner.parseDateField(raw, 'delistDate') }),
      status: DataCleaner.requireString(raw, 'status') as ExtendedInstrument['status'],
      ...(raw.attributes != null && {
        attributes:
          typeof raw.attributes === 'string' ? JSON.parse(raw.attributes) : raw.attributes,
      }),
    };
  }

  /** 清洗单条 financialReport 记录 */
  static cleanFinancialReport(raw: RawDataRecord): FinancialReport {
    const reportType = DataCleaner.parseReportType(raw, 'reportType');
    return {
      symbol: DataCleaner.requireString(raw, 'symbol'),
      reportDate: DataCleaner.parseDateField(raw, 'reportDate'),
      announceDate: DataCleaner.parseDateField(raw, 'announceDate'),
      reportType,
      income: {
        revenue: DataCleaner.requireNumber(raw, 'revenue'),
        costOfRevenue: DataCleaner.requireNumber(raw, 'costOfRevenue'),
        operatingIncome: DataCleaner.requireNumber(raw, 'operatingIncome'),
        totalRevenue: DataCleaner.requireNumber(raw, 'totalRevenue'),
        netIncome: DataCleaner.requireNumber(raw, 'netIncome'),
      },
      balanceSheet: {
        totalAssets: DataCleaner.requireNumber(raw, 'totalAssets'),
        totalLiabilities: DataCleaner.requireNumber(raw, 'totalLiabilities'),
        totalEquity: DataCleaner.requireNumber(raw, 'totalEquity'),
        currentAssets: DataCleaner.requireNumber(raw, 'currentAssets'),
        currentLiabilities: DataCleaner.requireNumber(raw, 'currentLiabilities'),
      },
      cashFlow: {
        operatingCashFlow: DataCleaner.requireNumber(raw, 'operatingCashFlow'),
        investingCashFlow: DataCleaner.requireNumber(raw, 'investingCashFlow'),
        financingCashFlow: DataCleaner.requireNumber(raw, 'financingCashFlow'),
        freeCashFlow: DataCleaner.requireNumber(raw, 'freeCashFlow'),
      },
    };
  }

  /** 批量清洗 financialReport */
  static cleanFinancialReports(raws: RawDataRecord[]): FinancialReport[] {
    return raws.map((r) => DataCleaner.cleanFinancialReport(r));
  }

  /** 清洗单条 adjustmentFactor 记录 */
  static cleanAdjustmentFactor(raw: RawDataRecord): AdjustmentFactor {
    return {
      symbol: DataCleaner.requireString(raw, 'symbol'),
      date: DataCleaner.parseDateField(raw, 'date'),
      factor: DataCleaner.requireNumber(raw, 'factor'),
      type: DataCleaner.parseAdjustmentType(raw, 'type'),
    };
  }

  /** 批量清洗 adjustmentFactor */
  static cleanAdjustmentFactors(raws: RawDataRecord[]): AdjustmentFactor[] {
    return raws.map((r) => DataCleaner.cleanAdjustmentFactor(r));
  }

  /** 清洗 tradingCalendar 记录 */
  static cleanTradingCalendar(raw: RawDataRecord): TradingCalendar {
    const exchange = DataCleaner.requireString(raw, 'exchange');
    const year = DataCleaner.requireNumber(raw, 'year');
    const tradingDaysStr = DataCleaner.requireString(raw, 'tradingDays');
    const holidaysStr = DataCleaner.requireString(raw, 'holidays');

    // tradingDays 和 holidays 支持逗号分隔的 YYYYMMDD 字符串或 JSON 数组
    const tradingDays = DataCleaner.parseTimestampList(tradingDaysStr);
    const holidays = DataCleaner.parseTimestampList(holidaysStr);

    return {
      exchange,
      year,
      tradingDays,
      holidays,
      ...(raw.sessionType != null && { sessionType: String(raw.sessionType) }),
    };
  }

  /** 清洗单条 announcementEvent 记录 */
  static cleanAnnouncementEvent(raw: RawDataRecord): AnnouncementEvent {
    return {
      id: DataCleaner.requireString(raw, 'id'),
      symbol: DataCleaner.requireString(raw, 'symbol'),
      eventTime: DataCleaner.parseDateField(raw, 'eventTime'),
      eventType: DataCleaner.parseAnnouncementEventType(raw, 'eventType'),
      title: DataCleaner.requireString(raw, 'title'),
      ...(raw.description != null && { description: String(raw.description) }),
      impact: DataCleaner.parseEventImpact(raw, 'impact'),
    };
  }

  /** 批量清洗 announcementEvent */
  static cleanAnnouncementEvents(raws: RawDataRecord[]): AnnouncementEvent[] {
    return raws.map((r) => DataCleaner.cleanAnnouncementEvent(r));
  }

  /** 清洗单条 newsArticle 记录 */
  static cleanNewsArticle(raw: RawDataRecord): NewsArticle {
    const symbolsStr = DataCleaner.requireString(raw, 'symbols');
    const tagsStr = DataCleaner.requireString(raw, 'tags');
    return {
      id: DataCleaner.requireString(raw, 'id'),
      publishTime: DataCleaner.parseDateField(raw, 'publishTime'),
      title: DataCleaner.requireString(raw, 'title'),
      source: DataCleaner.requireString(raw, 'source'),
      symbols: DataCleaner.parseStringList(symbolsStr),
      ...(raw.sentimentScore != null && { sentimentScore: Number(raw.sentimentScore) }),
      tags: DataCleaner.parseStringList(tagsStr),
    };
  }

  /** 批量清洗 newsArticle */
  static cleanNewsArticles(raws: RawDataRecord[]): NewsArticle[] {
    return raws.map((r) => DataCleaner.cleanNewsArticle(r));
  }

  /** 清洗单条 shareholderMetrics 记录 */
  static cleanShareholderMetrics(raw: RawDataRecord): ShareholderMetrics {
    return {
      symbol: DataCleaner.requireString(raw, 'symbol'),
      announceDate: DataCleaner.parseDateField(raw, 'announceDate'),
      endDate: DataCleaner.parseDateField(raw, 'endDate'),
      totalHolders: DataCleaner.requireNumber(raw, 'totalHolders'),
      avgHoldingShares: DataCleaner.requireNumber(raw, 'avgHoldingShares'),
      avgHoldingAmount: DataCleaner.requireNumber(raw, 'avgHoldingAmount'),
      ...(raw.changeRatio != null && { changeRatio: Number(raw.changeRatio) }),
    };
  }

  /** 批量清洗 shareholderMetrics */
  static cleanShareholderMetricsBatch(raws: RawDataRecord[]): ShareholderMetrics[] {
    return raws.map((r) => DataCleaner.cleanShareholderMetrics(r));
  }

  private static requireString(raw: RawDataRecord, key: string): string {
    const val = raw[key];
    if (val == null || val === '') {
      throw new Error(`缺少必填字段: ${key}`);
    }
    return String(val);
  }

  private static requireNumber(raw: RawDataRecord, key: string): number {
    const val = raw[key];
    if (val == null || val === '') {
      throw new Error(`缺少必填字段: ${key}`);
    }
    const num = Number(val);
    if (Number.isNaN(num)) {
      throw new Error(`字段 ${key} 无法转为数字: ${val}`);
    }
    return num;
  }

  /**
   * 解析日期字段 — 支持三种模式：
   * - 'auto'（默认）：启发式判断 YYYYMMDD vs 毫秒时间戳
   * - 'yyyymmdd'：强制按 YYYYMMDD 格式解析
   * - 'timestamp'：强制按毫秒时间戳解析
   *
   * 建议在已知数据源格式时显式设置 DataCleaner.dateFormat，避免启发式误判。
   */
  private static parseDateField(raw: RawDataRecord, key: string): number {
    const val = raw[key];
    if (val == null || val === '') {
      throw new Error(`缺少必填字段: ${key}`);
    }
    const str = String(val);
    const num = Number(val);
    if (Number.isNaN(num)) {
      throw new Error(`字段 ${key} 无法转为日期: ${val}`);
    }

    const fmt = DataCleaner.dateFormat;

    // 显式 yyyymmdd 模式
    if (fmt === 'yyyymmdd') {
      if (/^\d{8}$/.test(str)) {
        return DataCleaner.yyyymmddToTimestamp(str);
      }
      throw new Error(`字段 ${key} 不符合 YYYYMMDD 格式: ${val}`);
    }

    // 显式 timestamp 模式
    if (fmt === 'timestamp') {
      return num;
    }

    // auto 模式：启发式判断
    // YYYYMMDD 格式：8 位纯数字且小于 99991231（不是毫秒时间戳）
    if (/^\d{8}$/.test(str) && num < 99991231) {
      return DataCleaner.yyyymmddToTimestamp(str);
    }
    return num;
  }

  /** 解析报告期类型 */
  private static parseReportType(raw: RawDataRecord, key: string): ReportType {
    const val = String(raw[key] ?? '').toLowerCase();
    const map: Record<string, ReportType> = {
      q1: ReportType.Q1,
      q2: ReportType.Q2,
      q3: ReportType.Q3,
      annual: ReportType.Annual,
      q4: ReportType.Annual,
      year: ReportType.Annual,
    };
    const result = map[val];
    if (!result) {
      throw new Error(`无法解析 reportType: ${raw[key]}`);
    }
    return result;
  }

  /** 解析复权方向 */
  private static parseAdjustmentType(raw: RawDataRecord, key: string): AdjustmentType {
    const val = String(raw[key] ?? '').toLowerCase();
    if (val === 'forward' || val === 'hfq') return AdjustmentType.Forward;
    if (val === 'backward' || val === 'bfq') return AdjustmentType.Backward;
    throw new Error(`无法解析 adjustmentType: ${raw[key]}`);
  }

  /** 解析公告事件类型 */
  private static parseAnnouncementEventType(
    raw: RawDataRecord,
    key: string
  ): AnnouncementEventType {
    const val = String(raw[key] ?? '').toLowerCase();
    const map: Record<string, AnnouncementEventType> = {
      st: AnnouncementEventType.ST,
      suspended: AnnouncementEventType.Suspended,
      dividend: AnnouncementEventType.Dividend,
      restructure: AnnouncementEventType.Restructure,
      ipo: AnnouncementEventType.IPO,
      delist: AnnouncementEventType.Delist,
      rightsissue: AnnouncementEventType.RightsIssue,
    };
    const result = map[val];
    if (!result) {
      throw new Error(`无法解析 eventType: ${raw[key]}`);
    }
    return result;
  }

  /** 解析事件影响方向 */
  private static parseEventImpact(raw: RawDataRecord, key: string): EventImpact {
    const val = String(raw[key] ?? '').toLowerCase();
    const map: Record<string, EventImpact> = {
      positive: EventImpact.Positive,
      neutral: EventImpact.Neutral,
      negative: EventImpact.Negative,
      unknown: EventImpact.Unknown,
    };
    return map[val] ?? EventImpact.Unknown;
  }

  /** 解析逗号分隔的时间戳列表（YYYYMMDD 或毫秒时间戳） */
  private static parseTimestampList(str: string): number[] {
    if (!str) return [];
    // 尝试 JSON 解析（数组格式）
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) {
        return arr.map((v: unknown) => {
          const s = String(v);
          if (/^\d{8}$/.test(s) && Number(s) < 99991231) {
            return DataCleaner.yyyymmddToTimestamp(s);
          }
          return Number(s);
        });
      }
    } catch {
      /* 不是 JSON，继续按逗号分隔 */
    }
    return str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        if (/^\d{8}$/.test(s) && Number(s) < 99991231) {
          return DataCleaner.yyyymmddToTimestamp(s);
        }
        return Number(s);
      });
  }

  /** 解析逗号分隔的字符串列表 */
  private static parseStringList(str: string): string[] {
    if (!str) return [];
    try {
      const arr = JSON.parse(str);
      if (Array.isArray(arr)) return arr.map(String);
    } catch {
      /* 不是 JSON */
    }
    return str
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /** YYYYMMDD 字符串转毫秒时间戳 */
  private static yyyymmddToTimestamp(s: string): number {
    const year = parseInt(s.substring(0, 4), 10);
    const month = parseInt(s.substring(4, 6), 10) - 1;
    const day = parseInt(s.substring(6, 8), 10);
    return Date.UTC(year, month, day);
  }
}
