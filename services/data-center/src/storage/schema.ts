/**
 * Drizzle ORM Schema — SQLite / PostgreSQL 共用
 *
 * 切换到 PostgreSQL 时只需改 driver，Schema 定义不变。
 * 所有时间戳字段统一用 integer（毫秒时间戳），避免跨数据库日期类型差异。
 */
import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

// ─── L1 行情 ───────────────────────────────────────────

/** K 线表 */
export const bars = sqliteTable(
  'bars',
  {
    symbol: text('symbol').notNull(),
    timeframe: text('timeframe').notNull(),
    timestamp: integer('timestamp').notNull(),
    open: real('open').notNull(),
    high: real('high').notNull(),
    low: real('low').notNull(),
    close: real('close').notNull(),
    volume: real('volume').notNull(),
    turnover: real('turnover').notNull().default(0),
    openInterest: real('open_interest'),
    numTrades: integer('num_trades'),
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.timeframe, table.timestamp] }),
    index('idx_bars_symbol_tf').on(table.symbol, table.timeframe),
    index('idx_bars_ts').on(table.timestamp),
  ]
);

/** Tick 表 */
export const ticks = sqliteTable(
  'ticks',
  {
    symbol: text('symbol').notNull(),
    timestamp: integer('timestamp').notNull(),
    price: real('price').notNull(),
    volume: real('volume').notNull(),
    bid: real('bid').notNull(),
    ask: real('ask').notNull(),
    bidVolume: real('bid_volume').notNull().default(0),
    askVolume: real('ask_volume').notNull().default(0),
    bidOrders: integer('bid_orders'),
    askOrders: integer('ask_orders'),
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.timestamp] }),
    index('idx_ticks_symbol').on(table.symbol),
    index('idx_ticks_ts').on(table.timestamp),
  ]
);

// ─── 参考数据 ───────────────────────────────────────────

/** 标的表 */
export const instruments = sqliteTable(
  'instruments',
  {
    symbol: text('symbol').primaryKey(),
    name: text('name').notNull(),
    exchange: text('exchange').notNull(),
    lotSize: integer('lot_size').notNull(),
    priceTick: real('price_tick').notNull(),
    industry: text('industry').notNull(),
    sector: text('sector').notNull(),
    listDate: integer('list_date').notNull(),
    delistDate: integer('delist_date'),
    status: text('status', { enum: ['active', 'suspended', 'delisted'] }).notNull(),
    attributes: text('attributes'), // JSON: Record<string, unknown>
  },
  (table) => [
    index('idx_instruments_exchange').on(table.exchange),
    index('idx_instruments_industry').on(table.industry),
  ]
);

/** 交易日历表 */
export const tradingCalendars = sqliteTable(
  'trading_calendars',
  {
    exchange: text('exchange').notNull(),
    year: integer('year').notNull(),
    tradingDays: text('trading_days').notNull(), // JSON 数组
    holidays: text('holidays').notNull(), // JSON 数组
    sessionType: text('session_type'), // 交易时段类型
  },
  (table) => [primaryKey({ columns: [table.exchange, table.year] })]
);

/** 指数成分表 */
export const indexConstituents = sqliteTable(
  'index_constituents',
  {
    indexSymbol: text('index_symbol').notNull(),
    asOfDate: integer('as_of_date').notNull(),
    symbol: text('symbol').notNull(),
    weight: real('weight').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.indexSymbol, table.asOfDate, table.symbol] }),
    index('idx_idxcomp_index_date').on(table.indexSymbol, table.asOfDate),
  ]
);

/** 复权因子表 */
export const adjustmentFactors = sqliteTable(
  'adjustment_factors',
  {
    symbol: text('symbol').notNull(),
    date: integer('date').notNull(),
    factor: real('factor').notNull(),
    type: text('type', { enum: ['forward', 'backward'] }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.date] }),
    index('idx_adj_symbol').on(table.symbol),
  ]
);

// ─── 基本面 ─────────────────────────────────────────────

/** 财报表 */
export const financialReports = sqliteTable(
  'financial_reports',
  {
    symbol: text('symbol').notNull(),
    reportDate: integer('report_date').notNull(),
    announceDate: integer('announce_date').notNull(),
    reportType: text('report_type', { enum: ['q1', 'q2', 'q3', 'annual'] }).notNull(),
    // 利润表
    revenue: real('revenue').notNull(),
    costOfRevenue: real('cost_of_revenue').notNull(),
    operatingIncome: real('operating_income').notNull(),
    totalRevenue: real('total_revenue').notNull(),
    netIncome: real('net_income').notNull(),
    // 资产负债表
    totalAssets: real('total_assets').notNull(),
    totalLiabilities: real('total_liabilities').notNull(),
    totalEquity: real('total_equity').notNull(),
    currentAssets: real('current_assets').notNull(),
    currentLiabilities: real('current_liabilities').notNull(),
    // 现金流量表
    operatingCashFlow: real('operating_cash_flow').notNull(),
    investingCashFlow: real('investing_cash_flow').notNull(),
    financingCashFlow: real('financing_cash_flow').notNull(),
    freeCashFlow: real('free_cash_flow').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.reportDate] }),
    index('idx_finrep_announce').on(table.symbol, table.announceDate),
  ]
);

/** 财务比率表 */
export const financialRatios = sqliteTable(
  'financial_ratios',
  {
    symbol: text('symbol').notNull(),
    asOfDate: integer('as_of_date').notNull(),
    roe: real('roe').notNull(),
    roa: real('roa').notNull(),
    eps: real('eps').notNull(),
    pe: real('pe').notNull(),
    pb: real('pb').notNull(),
    ps: real('ps').notNull(),
    debtToEquity: real('debt_to_equity').notNull(),
    currentRatio: real('current_ratio').notNull(),
    grossMargin: real('gross_margin').notNull(),
    netMargin: real('net_margin').notNull(),
  },
  (table) => [primaryKey({ columns: [table.symbol, table.asOfDate] })]
);

/** 估值表 */
export const valuations = sqliteTable(
  'valuations',
  {
    symbol: text('symbol').notNull(),
    timestamp: integer('timestamp').notNull(),
    marketCap: real('market_cap'),
    peTTM: real('pe_ttm'),
    pb: real('pb'),
    psTTM: real('ps_ttm'),
    dividendYield: real('dividend_yield'),
    // A 股扩展字段（Wind/xlsx 数据源常用）
    turnoverRate: real('turnover_rate'),
    floatShares: real('float_shares'),
    // 腾讯财经实时行情扩展字段（P1-D 补齐）
    limitUp: real('limit_up'),
    limitDown: real('limit_down'),
    volumeRatio: real('volume_ratio'),
    orderImbalance: real('order_imbalance'),
    avgVolume5d: real('avg_volume_5d'),
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.timestamp] }),
    index('idx_val_symbol').on(table.symbol),
  ]
);

// ─── 资讯事件 ───────────────────────────────────────────

/** 公告事件表 */
export const announcementEvents = sqliteTable(
  'announcement_events',
  {
    id: text('id').primaryKey(),
    symbol: text('symbol').notNull(),
    eventTime: integer('event_time').notNull(),
    eventType: text('event_type', {
      enum: ['st', 'suspended', 'dividend', 'restructure', 'ipo', 'delist', 'rightsIssue'],
    }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    impact: text('impact', { enum: ['positive', 'neutral', 'negative', 'unknown'] }).notNull(),
  },
  (table) => [index('idx_announce_symbol').on(table.symbol, table.eventTime)]
);

/** 新闻表 */
export const newsArticles = sqliteTable(
  'news_articles',
  {
    id: text('id').primaryKey(),
    publishTime: integer('publish_time').notNull(),
    title: text('title').notNull(),
    source: text('source').notNull(),
    symbols: text('symbols').notNull(), // JSON 数组
    sentimentScore: real('sentiment_score'),
    tags: text('tags').notNull(), // JSON 数组
  },
  (table) => [index('idx_news_time').on(table.publishTime)]
);

/** 情绪指标表 */
export const sentimentPoints = sqliteTable(
  'sentiment_points',
  {
    symbol: text('symbol').notNull(),
    timestamp: integer('timestamp').notNull(),
    score: real('score').notNull(),
    sampleSize: integer('sample_size').notNull(),
  },
  (table) => [primaryKey({ columns: [table.symbol, table.timestamp] })]
);

/** 宏观指标定义表 */
export const macroIndicatorDefs = sqliteTable('macro_indicator_defs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  unit: text('unit').notNull(),
  frequency: text('frequency', { enum: ['daily', 'monthly', 'quarterly', 'yearly'] }).notNull(),
  source: text('source').notNull(),
});

/** 宏观数据点表 */
export const macroPoints = sqliteTable(
  'macro_points',
  {
    indicatorId: text('indicator_id').notNull(),
    timestamp: integer('timestamp').notNull(),
    value: real('value').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.indicatorId, table.timestamp] }),
    index('idx_macro_indicator').on(table.indicatorId),
  ]
);

// ─── L2 行情 ───────────────────────────────────────────

/** L2 盘口快照表 */
export const l2Snapshots = sqliteTable(
  'l2_snapshots',
  {
    symbol: text('symbol').notNull(),
    timestamp: integer('timestamp').notNull(),
    bids: text('bids').notNull(), // JSON: OrderBookEntry[]
    asks: text('asks').notNull(), // JSON: OrderBookEntry[]
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.timestamp] }),
    index('idx_l2snap_symbol').on(table.symbol),
  ]
);

/** 逐笔成交表 */
export const tradeRecords = sqliteTable(
  'trade_records',
  {
    symbol: text('symbol').notNull(),
    timestamp: integer('timestamp').notNull(),
    price: real('price').notNull(),
    volume: real('volume').notNull(),
    side: text('side', { enum: ['buy', 'sell', 'unknown'] }).notNull(),
    tradeType: text('trade_type', { enum: ['normal', 'block', 'auction'] }).notNull(),
  },
  (table) => [index('idx_traderec_symbol').on(table.symbol, table.timestamp)]
);

/** 逐笔委托表 */
export const orderRecords = sqliteTable(
  'order_records',
  {
    symbol: text('symbol').notNull(),
    timestamp: integer('timestamp').notNull(),
    price: real('price').notNull(),
    volume: real('volume').notNull(),
    action: text('action', { enum: ['add', 'cancel', 'trade'] }).notNull(),
    orderType: text('order_type', { enum: ['limit', 'market'] }).notNull(),
  },
  (table) => [index('idx_orderrec_symbol').on(table.symbol, table.timestamp)]
);

// ─── 基本面：股东人数 ──────────────────────────────────────

/** 股东人数表 */
export const shareholderMetrics = sqliteTable(
  'shareholder_metrics',
  {
    symbol: text('symbol').notNull(),
    announceDate: integer('announce_date').notNull(),
    endDate: integer('end_date').notNull(),
    totalHolders: real('total_holders').notNull(),
    avgHoldingShares: real('avg_holding_shares').notNull(),
    avgHoldingAmount: real('avg_holding_amount').notNull(),
    changeRatio: real('change_ratio'),
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.announceDate] }),
    index('idx_shm_symbol').on(table.symbol),
    index('idx_shm_enddate').on(table.endDate),
  ]
);

// ─── 水位 ───────────────────────────────────────────────

/** 水位表 — 记录数据源采集进度 */
export const watermarks = sqliteTable(
  'watermarks',
  {
    source: text('source').notNull(),
    dataType: text('data_type').notNull(),
    symbol: text('symbol').notNull(),
    lastTimestamp: integer('last_timestamp').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [primaryKey({ columns: [table.source, table.dataType, table.symbol] })]
);

// ─── 因子定义 ─────────────────────────────────────────────

/** 因子定义表 */
export const factorDefinitions = sqliteTable('factor_definitions', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  formula: text('formula').notNull(),
  category: text('category').notNull(),
  modes: text('modes').notNull(), // JSON array
  frequency: text('frequency').notNull(),
  status: text('status').notNull(),
  version: text('version').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ─── 任务 ─────────────────────────────────────────────────

/** 任务表 */
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  payload: text('payload').notNull(), // JSON
  submittedAt: integer('submitted_at').notNull(),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  result: text('result'), // JSON
  error: text('error'),
  progress: integer('progress'),
  lines: text('lines'), // JSON array
});

// ─── 扩展数据（通用外部记录） ──────────────────────────────

/**
 * 扩展数据表 — 通用载体，承载尚未独立建表的数据类型
 * dataType 取值：dragon_tiger / lockup / margin / block_trade / dividend /
 *                research_report / hot_stocks / northbound_flow / f10 / factor_result 等
 * payload 为 JSON 文本，由调用方约定结构
 */
export const externalRecords = sqliteTable(
  'external_records',
  {
    id: text('id').primaryKey(),
    dataType: text('data_type').notNull(),
    symbol: text('symbol').notNull(),
    timestamp: integer('timestamp').notNull(),
    payload: text('payload').notNull(), // JSON
    source: text('source').notNull(),
  },
  (table) => [
    index('idx_ext_type_symbol').on(table.dataType, table.symbol),
    index('idx_ext_ts').on(table.timestamp),
  ]
);
