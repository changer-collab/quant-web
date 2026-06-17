// services/data-center/src/storage.ts
// 此入口在主入口基础上额外导出存储层（服务端专用）
// 浏览器端不应引用此入口

// 重新导出所有基础类型和枚举
export {
  TimeFrame, ResearchMode,
  InstrumentStatus, AdjustmentType,
  ReportType,
  AnnouncementEventType, EventImpact, MacroFrequency,
  TradeSide, TradeType, OrderAction, L2OrderType,
  IssueSeverity,
} from './index.js';

export type {
  Instrument, Bar, Tick, MarketEvent,
  TradingCalendar, ExtendedInstrument, IndexComposition, IndexConstituent, AdjustmentFactor,
  ReferenceQuery, ReferenceDataProvider,
  ExtendedBar, ExtendedTick, MarketDataQuery, MarketDataProvider,
  OrderBookEntry, Level2Snapshot, TradeRecord, OrderRecord, Level2DataProvider,
  IncomeStatement, BalanceSheet, CashFlowStatement,
  FinancialReport, FinancialRatio, ValuationPoint, ShareholderMetrics,
  FundamentalQuery, FundamentalDataProvider,
  AnnouncementEvent, NewsArticle, SentimentPoint, MacroIndicatorDef, MacroPoint,
  EventDataProvider,
  ConsistencyIssue, DataQualityReport, DataQualityChecker,
  BarRepository, TickRepository, InstrumentRepository,
  CalendarRepository, IndexCompositionRepository, AdjustmentFactorRepository,
  FinancialReportRepository, FinancialRatioRepository, ValuationRepository,
  ShareholderMetricsRepository,
  AnnouncementEventRepository, NewsRepository, SentimentRepository,
  MacroIndicatorRepository,
  Level2SnapshotRepository, TradeRecordRepository, OrderRecordRepository,
  Watermark, WatermarkRepository, PageParams, PageResult,
  DataExporter, ExportFormat, RepositorySet,
  DataCenterConfig, DataCenter, PersistenceStrategy, DataCenterStatus,
  LifecycleHooks, HealthCheckResult,
  DrizzleDb, SqliteContext,
} from './index.js';

// storage — 存储层实现
export { createDataCenter, createSqliteRepositorySet, createProviders } from './storage/factory.js';
export { createSqliteConnection, createSqliteContext, resolveDbPath } from './storage/sqlite/connection.js';

// provider — Provider 实现
export {
  ReferenceDataProviderImpl,
  MarketDataProviderImpl,
  FundamentalDataProviderImpl,
  EventDataProviderImpl,
  Level2DataProviderImpl,
  DataQualityCheckerImpl,
  DataExporterImpl,
} from './provider/index.js';

// errors — 错误类型
export { DataCenterError, NotFoundError, ValidationError, WriteError, QueryError, CloseError } from './errors.js';