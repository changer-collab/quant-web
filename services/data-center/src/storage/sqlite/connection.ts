/**
 * SQLite 连接管理 — better-sqlite3 实现（原生预编译二进制，零本地编译）
 *
 * 默认路径：项目根目录 data/quant.db
 * 可通过环境变量 QUANT_DB_PATH 覆盖。
 *
 * 与 sql.js 的差异：
 * - better-sqlite3 直接读写磁盘文件，写入即持久化，无需手动 export/save。
 * - 启用 WAL 模式提升并发读写性能；flush 时做 wal_checkpoint 确保数据
 *   落入主库文件，供跨进程读取方（如 Python DataClient）看到最新数据。
 * - 同步驱动：Drizzle 查询仍可 await（thenable 包装），但事务回调必须是
 *   同步函数，不能返回 Promise。
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../schema.js';
import path from 'node:path';
import fs from 'node:fs';
import { WriteError, DataCenterError } from '../../errors.js';

/** better-sqlite3 数据库实例类型 */
type SqliteDatabase = Database.Database;

/** Drizzle ORM 数据库实例类型（含 Schema 映射） */
export type DrizzleDb = BetterSQLite3Database<typeof schema>;

/** SQLite 连接上下文 — 包含 Drizzle 实例和底层 better-sqlite3 实例 */
export interface SqliteContext {
  db: DrizzleDb;
  raw: SqliteDatabase;
  dbPath: string;
}

/** 获取数据库文件路径 */
export function resolveDbPath(override?: string): string {
  if (override) return override;
  const envPath = process.env.QUANT_DB_PATH;
  if (envPath) return envPath;
  return path.resolve(process.cwd(), 'data', 'quant.db');
}

/** 打开 better-sqlite3 连接并应用通用 PRAGMA */
function openDatabase(resolvedPath: string): SqliteDatabase {
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const sqlite = new Database(resolvedPath);
  // WAL 模式：并发读写更友好；外键约束与原 sql.js 实现保持一致
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  return sqlite;
}

/** 创建 SQLite 连接上下文（包含 Drizzle + 原始 better-sqlite3 实例） */
export async function createSqliteContext(dbPath?: string): Promise<SqliteContext> {
  try {
    const resolvedPath = resolveDbPath(dbPath);
    const sqlite = openDatabase(resolvedPath);
    runMigrations(sqlite);

    return {
      db: drizzle(sqlite, { schema }),
      raw: sqlite,
      dbPath: resolvedPath,
    };
  } catch (err) {
    throw new DataCenterError(
      `创建 SQLite 连接失败${dbPath ? ` (dbPath=${dbPath})` : ''}`,
      'CONNECTION_ERROR',
      err
    );
  }
}

/** 创建 better-sqlite3 连接并初始化 Drizzle（向后兼容） */
export async function createSqliteConnection(dbPath?: string): Promise<DrizzleDb> {
  const ctx = await createSqliteContext(dbPath);
  return ctx.db;
}

/** 建表 DDL — 所有表的 CREATE TABLE IF NOT EXISTS */
const DDL = `
CREATE TABLE IF NOT EXISTS bars (
  symbol TEXT NOT NULL, timeframe TEXT NOT NULL, timestamp INTEGER NOT NULL,
  open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
  volume REAL NOT NULL, turnover REAL NOT NULL DEFAULT 0,
  open_interest REAL, num_trades INTEGER,
  PRIMARY KEY (symbol, timeframe, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_bars_symbol_tf ON bars(symbol, timeframe);
CREATE INDEX IF NOT EXISTS idx_bars_ts ON bars(timestamp);

CREATE TABLE IF NOT EXISTS ticks (
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  price REAL NOT NULL, volume REAL NOT NULL,
  bid REAL NOT NULL, ask REAL NOT NULL,
  bid_volume REAL NOT NULL DEFAULT 0, ask_volume REAL NOT NULL DEFAULT 0,
  bid_orders INTEGER, ask_orders INTEGER,
  PRIMARY KEY (symbol, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_ticks_symbol ON ticks(symbol);
CREATE INDEX IF NOT EXISTS idx_ticks_ts ON ticks(timestamp);

CREATE TABLE IF NOT EXISTS instruments (
  symbol TEXT PRIMARY KEY, name TEXT NOT NULL, exchange TEXT NOT NULL,
  lot_size INTEGER NOT NULL, price_tick REAL NOT NULL,
  industry TEXT NOT NULL, sector TEXT NOT NULL,
  list_date INTEGER NOT NULL, delist_date INTEGER,
  status TEXT NOT NULL, attributes TEXT
);
CREATE INDEX IF NOT EXISTS idx_instruments_exchange ON instruments(exchange);
CREATE INDEX IF NOT EXISTS idx_instruments_industry ON instruments(industry);

CREATE TABLE IF NOT EXISTS trading_calendars (
  exchange TEXT NOT NULL, year INTEGER NOT NULL,
  trading_days TEXT NOT NULL, holidays TEXT NOT NULL,
  session_type TEXT,
  PRIMARY KEY (exchange, year)
);

CREATE TABLE IF NOT EXISTS index_constituents (
  index_symbol TEXT NOT NULL, as_of_date INTEGER NOT NULL,
  symbol TEXT NOT NULL, weight REAL NOT NULL,
  PRIMARY KEY (index_symbol, as_of_date, symbol)
);
CREATE INDEX IF NOT EXISTS idx_idxcomp_index_date ON index_constituents(index_symbol, as_of_date);

CREATE TABLE IF NOT EXISTS adjustment_factors (
  symbol TEXT NOT NULL, date INTEGER NOT NULL,
  factor REAL NOT NULL, type TEXT NOT NULL,
  PRIMARY KEY (symbol, date)
);
CREATE INDEX IF NOT EXISTS idx_adj_symbol ON adjustment_factors(symbol);

CREATE TABLE IF NOT EXISTS financial_reports (
  symbol TEXT NOT NULL, report_date INTEGER NOT NULL,
  announce_date INTEGER NOT NULL, report_type TEXT NOT NULL,
  revenue REAL NOT NULL, cost_of_revenue REAL NOT NULL,
  operating_income REAL NOT NULL, total_revenue REAL NOT NULL, net_income REAL NOT NULL,
  total_assets REAL NOT NULL, total_liabilities REAL NOT NULL, total_equity REAL NOT NULL,
  current_assets REAL NOT NULL, current_liabilities REAL NOT NULL,
  operating_cash_flow REAL NOT NULL, investing_cash_flow REAL NOT NULL,
  financing_cash_flow REAL NOT NULL, free_cash_flow REAL NOT NULL,
  PRIMARY KEY (symbol, report_date)
);
CREATE INDEX IF NOT EXISTS idx_finrep_announce ON financial_reports(symbol, announce_date);
CREATE INDEX IF NOT EXISTS idx_finrep_pit ON financial_reports(symbol, announce_date, report_date);

CREATE TABLE IF NOT EXISTS financial_ratios (
  symbol TEXT NOT NULL, as_of_date INTEGER NOT NULL,
  roe REAL NOT NULL, roa REAL NOT NULL, eps REAL NOT NULL,
  pe REAL NOT NULL, pb REAL NOT NULL, ps REAL NOT NULL,
  debt_to_equity REAL NOT NULL, current_ratio REAL NOT NULL,
  gross_margin REAL NOT NULL, net_margin REAL NOT NULL,
  PRIMARY KEY (symbol, as_of_date)
);

CREATE TABLE IF NOT EXISTS valuations (
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  market_cap REAL, pe_ttm REAL, pb REAL,
  ps_ttm REAL, dividend_yield REAL,
  turnover_rate REAL, float_shares REAL,
  limit_up REAL, limit_down REAL,
  volume_ratio REAL, order_imbalance REAL, avg_volume_5d REAL,
  PRIMARY KEY (symbol, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_val_symbol ON valuations(symbol);

CREATE TABLE IF NOT EXISTS shareholder_metrics (
  symbol TEXT NOT NULL, announce_date INTEGER NOT NULL,
  end_date INTEGER NOT NULL, total_holders INTEGER,
  avg_holding_shares REAL, avg_holding_amount REAL,
  change_ratio REAL,
  PRIMARY KEY (symbol, announce_date)
);
CREATE INDEX IF NOT EXISTS idx_shm_symbol ON shareholder_metrics(symbol, announce_date);

CREATE TABLE IF NOT EXISTS announcement_events (
  id TEXT PRIMARY KEY, symbol TEXT NOT NULL, event_time INTEGER NOT NULL,
  event_type TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
  impact TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_announce_symbol ON announcement_events(symbol, event_time);

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY, publish_time INTEGER NOT NULL,
  title TEXT NOT NULL, source TEXT NOT NULL,
  symbols TEXT NOT NULL, sentiment_score REAL, tags TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_news_time ON news_articles(publish_time);

CREATE TABLE IF NOT EXISTS sentiment_points (
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  score REAL NOT NULL, sample_size INTEGER NOT NULL,
  PRIMARY KEY (symbol, timestamp)
);

CREATE TABLE IF NOT EXISTS macro_indicator_defs (
  id TEXT PRIMARY KEY, name TEXT NOT NULL,
  unit TEXT NOT NULL, frequency TEXT NOT NULL, source TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS macro_points (
  indicator_id TEXT NOT NULL, timestamp INTEGER NOT NULL, value REAL NOT NULL,
  PRIMARY KEY (indicator_id, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_macro_indicator ON macro_points(indicator_id);

CREATE TABLE IF NOT EXISTS l2_snapshots (
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  bids TEXT NOT NULL, asks TEXT NOT NULL,
  PRIMARY KEY (symbol, timestamp)
);
CREATE INDEX IF NOT EXISTS idx_l2snap_symbol ON l2_snapshots(symbol);

CREATE TABLE IF NOT EXISTS trade_records (
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  price REAL NOT NULL, volume REAL NOT NULL,
  side TEXT NOT NULL, trade_type TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traderec_symbol ON trade_records(symbol, timestamp);

CREATE TABLE IF NOT EXISTS order_records (
  symbol TEXT NOT NULL, timestamp INTEGER NOT NULL,
  price REAL NOT NULL, volume REAL NOT NULL,
  action TEXT NOT NULL, order_type TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_orderrec_symbol ON order_records(symbol, timestamp);

CREATE TABLE IF NOT EXISTS watermarks (
  source TEXT NOT NULL, data_type TEXT NOT NULL, symbol TEXT NOT NULL,
  last_timestamp INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (source, data_type, symbol)
);

CREATE TABLE IF NOT EXISTS factor_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  formula TEXT NOT NULL,
  category TEXT NOT NULL,
  modes TEXT NOT NULL,
  frequency TEXT NOT NULL,
  status TEXT NOT NULL,
  version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  result TEXT,
  error TEXT,
  progress INTEGER,
  lines TEXT
);

CREATE TABLE IF NOT EXISTS external_records (
  id TEXT PRIMARY KEY,
  data_type TEXT NOT NULL,
  symbol TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  payload TEXT NOT NULL,
  source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ext_type_symbol ON external_records(data_type, symbol);
CREATE INDEX IF NOT EXISTS idx_ext_ts ON external_records(timestamp);
`;

/** 执行建表迁移 + 增量 ALTER TABLE（兼容已有库） */
function runMigrations(db: SqliteDatabase): void {
  db.exec(DDL);
  // 增量迁移：为已有表添加新列
  // SQLite 不支持 IF NOT EXISTS for ALTER TABLE，用 try/catch 处理列已存在的情况
  const alterStatements = [
    'ALTER TABLE instruments ADD COLUMN attributes TEXT',
    'ALTER TABLE trading_calendars ADD COLUMN session_type TEXT',
    // P1-D: valuations 表新增 5 个腾讯财经扩展字段
    'ALTER TABLE valuations ADD COLUMN limit_up REAL',
    'ALTER TABLE valuations ADD COLUMN limit_down REAL',
    'ALTER TABLE valuations ADD COLUMN volume_ratio REAL',
    'ALTER TABLE valuations ADD COLUMN order_imbalance REAL',
    'ALTER TABLE valuations ADD COLUMN avg_volume_5d REAL',
  ];
  for (const sql of alterStatements) {
    try {
      db.exec(sql);
    } catch {
      // 列已存在，忽略错误（SQLite 会抛出 "duplicate column name"）
    }
  }
}

/** 获取底层 better-sqlite3 Database 实例 */
export async function createRawSqlJs(dbPath?: string): Promise<SqliteDatabase> {
  const resolvedPath = resolveDbPath(dbPath);
  return openDatabase(resolvedPath);
}

/**
 * 持久化 / 检查点 — better-sqlite3 写入即落盘，此处做 WAL 检查点，
 * 确保 WAL 中的数据合并入主库文件，供跨进程读取方看到最新数据。
 */
export function saveDbToFile(db: SqliteDatabase, dbPath?: string): void {
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch (err) {
    throw new WriteError(`WAL 检查点失败: ${resolveDbPath(dbPath)}`, err);
  }
}
