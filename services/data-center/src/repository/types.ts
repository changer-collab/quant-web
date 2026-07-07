/**
 * Repository 抽象接口 — 存储层与业务层解耦
 *
 * SQLite 和 PostgreSQL 实现同一套接口，切换只需改工厂函数。
 */
import type { TimeFrame } from '../base/types.js';
import type { ExtendedBar, ExtendedTick } from '../market/types.js';
import type {
  TradingCalendar,
  ExtendedInstrument,
  IndexComposition,
  AdjustmentFactor,
  ReferenceQuery,
} from '../reference/types.js';
export type { ReferenceQuery } from '../reference/types.js';
import type {
  FinancialReport,
  FinancialRatio,
  ValuationPoint,
  ShareholderMetrics,
} from '../fundamental/types.js';
import type {
  AnnouncementEvent,
  NewsArticle,
  SentimentPoint,
  MacroIndicatorDef,
  MacroPoint,
} from '../event/types.js';
import type { Level2Snapshot, TradeRecord, OrderRecord } from '../l2/types.js';

// ─── L1 行情 ───────────────────────────────────────────

/** K 线存储接口 */
export interface BarRepository {
  save(bars: ExtendedBar[]): Promise<void>;
  query(symbol: string, timeframe: TimeFrame, start?: number, end?: number): Promise<ExtendedBar[]>;
  getLatest(symbol: string, timeframe: TimeFrame): Promise<ExtendedBar | undefined>;
  getAvailableSymbols(timeframe?: TimeFrame): Promise<string[]>;
  count(symbol: string, timeframe: TimeFrame, start?: number, end?: number): Promise<number>;
  /** cursor 分页查询 */
  queryPaged(
    symbol: string,
    timeframe: TimeFrame,
    params?: PageParams
  ): Promise<PageResult<ExtendedBar>>;
}

/** Tick 存储接口 */
export interface TickRepository {
  save(ticks: ExtendedTick[]): Promise<void>;
  query(symbol: string, start?: number, end?: number): Promise<ExtendedTick[]>;
  getLatest(symbol: string): Promise<ExtendedTick | undefined>;
  /** cursor 分页查询 */
  queryPaged(symbol: string, params?: PageParams): Promise<PageResult<ExtendedTick>>;
}

// ─── 参考数据 ───────────────────────────────────────────

/** 标的存储接口 */
export interface InstrumentRepository {
  save(instruments: ExtendedInstrument[]): Promise<void>;
  query(query?: ReferenceQuery): Promise<ExtendedInstrument[]>;
  getBySymbol(symbol: string): Promise<ExtendedInstrument | undefined>;
}

/** 交易日历存储接口 */
export interface CalendarRepository {
  save(calendar: TradingCalendar): Promise<void>;
  get(exchange: string, year: number): Promise<TradingCalendar | undefined>;
}

/** 指数成分存储接口 */
export interface IndexCompositionRepository {
  save(composition: IndexComposition): Promise<void>;
  get(indexSymbol: string, asOfDate: number): Promise<IndexComposition | undefined>;
}

/** 复权因子存储接口 */
export interface AdjustmentFactorRepository {
  save(factors: AdjustmentFactor[]): Promise<void>;
  query(symbol: string, start?: number, end?: number): Promise<AdjustmentFactor[]>;
}

// ─── 基本面 ─────────────────────────────────────────────

/** 财报存储接口 */
export interface FinancialReportRepository {
  save(reports: FinancialReport[]): Promise<void>;
  /** 查询财报。asOfDate 为 PIT 过滤：仅返回 announceDate <= asOfDate 的记录 */
  query(
    symbol: string,
    start?: number,
    end?: number,
    asOfDate?: number
  ): Promise<FinancialReport[]>;
  getLatest(symbol: string): Promise<FinancialReport | undefined>;
}

/** 财务比率存储接口 */
export interface FinancialRatioRepository {
  save(ratios: FinancialRatio[]): Promise<void>;
  query(symbol: string, start?: number, end?: number, asOfDate?: number): Promise<FinancialRatio[]>;
}

/** 股东人数存储接口 */
export interface ShareholderMetricsRepository {
  save(metrics: ShareholderMetrics[]): Promise<void>;
  query(
    symbol: string,
    start?: number,
    end?: number,
    asOfDate?: number
  ): Promise<ShareholderMetrics[]>;
  getLatest(symbol: string): Promise<ShareholderMetrics | undefined>;
}

/** 估值存储接口 */
export interface ValuationRepository {
  save(valuations: ValuationPoint[]): Promise<void>;
  query(symbol: string, start?: number, end?: number, asOfDate?: number): Promise<ValuationPoint[]>;
}

// ─── 资讯事件 ───────────────────────────────────────────

/** 公告事件存储接口 */
export interface AnnouncementEventRepository {
  save(events: AnnouncementEvent[]): Promise<void>;
  query(symbol: string, start?: number, end?: number): Promise<AnnouncementEvent[]>;
}

/** 新闻存储接口 */
export interface NewsRepository {
  save(articles: NewsArticle[]): Promise<void>;
  query(symbols: string[], start?: number, end?: number, limit?: number): Promise<NewsArticle[]>;
}

/** 情绪指标存储接口 */
export interface SentimentRepository {
  save(points: SentimentPoint[]): Promise<void>;
  query(symbol: string, start?: number, end?: number): Promise<SentimentPoint[]>;
}

/** 宏观指标定义存储接口 */
export interface MacroIndicatorRepository {
  saveDefinitions(defs: MacroIndicatorDef[]): Promise<void>;
  getDefinitions(): Promise<MacroIndicatorDef[]>;
  savePoints(points: MacroPoint[]): Promise<void>;
  getPoints(indicatorId: string, start?: number, end?: number): Promise<MacroPoint[]>;
}

// ─── L2 行情 ───────────────────────────────────────────

/** L2 盘口快照存储接口 */
export interface Level2SnapshotRepository {
  save(snapshots: Level2Snapshot[]): Promise<void>;
  query(symbol: string, start?: number, end?: number): Promise<Level2Snapshot[]>;
  getLatest(symbol: string): Promise<Level2Snapshot | undefined>;
  /** cursor 分页查询 */
  queryPaged(symbol: string, params?: PageParams): Promise<PageResult<Level2Snapshot>>;
}

/** 逐笔成交存储接口 */
export interface TradeRecordRepository {
  save(records: TradeRecord[]): Promise<void>;
  query(symbol: string, start?: number, end?: number): Promise<TradeRecord[]>;
  /** cursor 分页查询 */
  queryPaged(symbol: string, params?: PageParams): Promise<PageResult<TradeRecord>>;
}

/** 逐笔委托存储接口 */
export interface OrderRecordRepository {
  save(records: OrderRecord[]): Promise<void>;
  query(symbol: string, start?: number, end?: number): Promise<OrderRecord[]>;
  /** cursor 分页查询 */
  queryPaged(symbol: string, params?: PageParams): Promise<PageResult<OrderRecord>>;
}

// ─── 水位 ───────────────────────────────────────────────

/** 分页参数（cursor 方式） */
export interface PageParams {
  /** 每页条数，默认 1000 */
  limit?: number;
  /** 游标：从该时间戳之后开始（不含此值） */
  afterTimestamp?: number;
}

/** 分页结果 */
export interface PageResult<T> {
  data: T[];
  /** 是否还有更多数据 */
  hasMore: boolean;
  /** 下一页游标（最后一条的 timestamp） */
  nextCursor?: number;
}

/** 水位记录 */
export interface Watermark {
  source: string;
  dataType: string;
  symbol: string;
  lastTimestamp: number;
  updatedAt: number;
}

/** 水位存储接口 */
export interface WatermarkRepository {
  get(source: string, dataType: string, symbol: string): Promise<Watermark | undefined>;
  upsert(watermark: Watermark): Promise<void>;
  list(source: string, dataType?: string): Promise<Watermark[]>;
}

// ─── 因子 ───────────────────────────────────────────────

/** 因子定义 */
export interface FactorDefinition {
  id: string;
  name: string;
  formula: string;
  category: string;
  modes: string[];
  frequency: string;
  status: string;
  version: string;
}

/** 因子存储接口 */
export interface FactorRepository {
  save(factor: FactorDefinition): Promise<void>;
  getAll(): Promise<FactorDefinition[]>;
  getById(id: string): Promise<FactorDefinition | undefined>;
  delete(id: string): Promise<void>;
}

// ─── 任务 ───────────────────────────────────────────────

/** 任务定义 */
export interface TaskDefinition {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
  progress?: number;
  lines?: string[];
}

/** 任务存储接口 */
export interface TaskRepository {
  save(task: TaskDefinition): Promise<void>;
  getById(id: string): Promise<TaskDefinition | undefined>;
  list(filter?: { type?: string; status?: string }): Promise<TaskDefinition[]>;
}

// ─── 扩展数据（通用外部记录） ──────────────────────────────

/** 扩展数据记录 — 通用载体 */
export interface ExternalRecord {
  /** 唯一 ID（建议 `${dataType}:${symbol}:${timestamp}` 或 UUID） */
  id: string;
  /** 数据类型：dragon_tiger / lockup / margin / block_trade / dividend / research_report / hot_stocks / northbound_flow / f10 / factor_result 等 */
  dataType: string;
  /** 标的代码（无对应标的时用 'INDEX' / 'MARKET' 等占位） */
  symbol: string;
  /** 时间戳（毫秒） */
  timestamp: number;
  /** JSON 负载，由调用方约定结构 */
  payload: Record<string, unknown>;
  /** 数据源名称 */
  source: string;
}

/** 扩展数据查询参数 */
export interface ExternalRecordQuery {
  dataType: string;
  symbol?: string;
  start?: number;
  end?: number;
  limit?: number;
}

/** 扩展数据存储接口 */
export interface ExternalRecordRepository {
  save(records: ExternalRecord[]): Promise<void>;
  query(params: ExternalRecordQuery): Promise<ExternalRecord[]>;
  /** 按数据类型删除（谨慎使用） */
  deleteByType(dataType: string, symbol?: string): Promise<void>;
}

// ─── 聚合：Repository 集合 ──────────────────────────────

/** 所有 Repository 的集合 — 由工厂函数创建 */
export interface RepositorySet {
  bars: BarRepository;
  ticks: TickRepository;
  instruments: InstrumentRepository;
  calendars: CalendarRepository;
  indexCompositions: IndexCompositionRepository;
  adjustmentFactors: AdjustmentFactorRepository;
  financialReports: FinancialReportRepository;
  financialRatios: FinancialRatioRepository;
  valuations: ValuationRepository;
  shareholderMetrics: ShareholderMetricsRepository;
  announcementEvents: AnnouncementEventRepository;
  news: NewsRepository;
  sentiments: SentimentRepository;
  macroIndicators: MacroIndicatorRepository;
  l2Snapshots: Level2SnapshotRepository;
  tradeRecords: TradeRecordRepository;
  orderRecords: OrderRecordRepository;
  watermarks: WatermarkRepository;
  factors: FactorRepository;
  tasks: TaskRepository;
  externalRecords: ExternalRecordRepository;
}

/** 数据导出格式 */
export type ExportFormat = 'json' | 'csv';

/** 数据导出接口 */
export interface DataExporter {
  /** 导出 K 线数据 */
  exportBars(
    symbol: string,
    timeframe: TimeFrame,
    start?: number,
    end?: number,
    format?: ExportFormat
  ): Promise<string>;
  /** 导出标的列表 */
  exportInstruments(query?: ReferenceQuery, format?: ExportFormat): Promise<string>;
}
