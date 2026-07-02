// base — 基础类型
export { TimeFrame, ResearchMode } from './base/index.js';
export type { Instrument, Bar, Tick, MarketEvent } from './base/index.js';

// reference — 参考数据
export { InstrumentStatus, AdjustmentType } from './reference/index.js';
export type {
  TradingCalendar,
  ExtendedInstrument,
  IndexComposition,
  IndexConstituent,
  AdjustmentFactor,
  ReferenceQuery,
  ReferenceDataProvider,
} from './reference/index.js';

// market — L1 行情
export type {
  ExtendedBar,
  ExtendedTick,
  MarketDataQuery,
  MarketDataProvider,
} from './market/index.js';

// l2 — L2 行情
export { TradeSide, TradeType, OrderAction, L2OrderType } from './l2/index.js';
export type {
  OrderBookEntry,
  Level2Snapshot,
  TradeRecord,
  OrderRecord,
  Level2DataProvider,
} from './l2/index.js';

// fundamental — 基本面
export { ReportType } from './fundamental/index.js';
export type {
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  FinancialReport,
  FinancialRatio,
  ValuationPoint,
  ShareholderMetrics,
  FundamentalQuery,
  FundamentalDataProvider,
} from './fundamental/index.js';

// event — 资讯事件
export { AnnouncementEventType, EventImpact, MacroFrequency } from './event/index.js';
export type {
  AnnouncementEvent,
  NewsArticle,
  SentimentPoint,
  MacroIndicatorDef,
  MacroPoint,
  EventDataProvider,
} from './event/index.js';

// quality — 数据质量
export { IssueSeverity } from './quality/index.js';
export type { ConsistencyIssue, DataQualityReport, DataQualityChecker } from './quality/index.js';

// repository — 存储抽象接口
export type {
  BarRepository,
  TickRepository,
  InstrumentRepository,
  CalendarRepository,
  IndexCompositionRepository,
  AdjustmentFactorRepository,
  FinancialReportRepository,
  FinancialRatioRepository,
  ValuationRepository,
  ShareholderMetricsRepository,
  AnnouncementEventRepository,
  NewsRepository,
  SentimentRepository,
  MacroIndicatorRepository,
  Level2SnapshotRepository,
  TradeRecordRepository,
  OrderRecordRepository,
  Watermark,
  WatermarkRepository,
  PageParams,
  PageResult,
  DataExporter,
  ExportFormat,
  RepositorySet,
  TaskDefinition,
  TaskRepository,
} from './repository/index.js';

// data-center 核心类型和工厂接口（无服务端实现）
export type {
  DataCenterConfig,
  DataCenter,
  PersistenceStrategy,
  DataCenterStatus,
  LifecycleHooks,
  HealthCheckResult,
} from './storage/factory.js';
export type { DrizzleDb, SqliteContext } from './storage/sqlite/connection.js';

// errors — 错误类型
export {
  DataCenterError,
  NotFoundError,
  ValidationError,
  WriteError,
  QueryError,
  CloseError,
} from './errors.js';
