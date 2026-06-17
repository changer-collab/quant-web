/**
 * SQLite 连接管理 — sql.js 实现（纯 WASM，零编译）
 *
 * 默认路径：项目根目录 data/quant.db
 * 可通过环境变量 QUANT_DB_PATH 覆盖。
 *
 * 注意：sql.js 是内存数据库，需要手动 load/save 到文件实现持久化。
 */
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js';
import * as schema from '../schema.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WriteError, DataCenterError } from '../../errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Drizzle ORM 数据库实例类型（含 Schema 映射） */
export type DrizzleDb = SQLJsDatabase<typeof schema>;

/** 获取 sql.js 包目录下的 wasm 文件路径 */
function resolveWasmPath(file: string): string {
  // 尝试从当前包 node_modules 定位（兼容 pnpm workspace）
  const fromPackage = path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', 'sql.js', 'dist', file);
  if (fs.existsSync(fromPackage)) return fromPackage;

  // 尝试从 process.cwd() 向上逐层查找
  const cwd = process.cwd();
  const parts = cwd.split(path.sep);
  for (let i = parts.length; i > 0; i--) {
    const candidate = path.resolve(...parts.slice(0, i), 'node_modules', 'sql.js', 'dist', file);
    if (fs.existsSync(candidate)) return candidate;
  }

  // 最后尝试：从 sql.js 包自身位置定位
  try {
    const resolved = import.meta.resolve('sql.js/dist/' + file);
    if (resolved.startsWith('file://')) {
      return fileURLToPath(resolved);
    }
  } catch {
    // ignore resolve failure
  }

  // 全部失败，返回默认路径（sql.js 会抛出明确错误）
  return path.resolve(cwd, 'node_modules', 'sql.js', 'dist', file);
}

/** SQLite 连接上下文 — 包含 Drizzle 实例和底层 sql.js 实例 */
export interface SqliteContext {
  db: DrizzleDb;
  raw: SqlJsDatabase;
  dbPath: string;
}

/** 获取数据库文件路径 */
export function resolveDbPath(override?: string): string {
  if (override) return override;
  const envPath = process.env.QUANT_DB_PATH;
  if (envPath) return envPath;
  return path.resolve(process.cwd(), 'data', 'quant.db');
}

/** sql.js WASM 文件路径（从 npm 包加载） */
function _getWasmPath(): string {
  // sql.js 的 wasm 文件在 node_modules/sql.js/dist/ 下
  // 从当前文件目录向上找（兼容 pnpm hoist 和独立安装）
  const possiblePaths = [
    path.resolve(__dirname, '..', '..', '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.resolve(process.cwd(), '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
    path.resolve(process.cwd(), '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  // 回退：让 sql.js 自己找
  return undefined as unknown as string;
}

/** 创建 SQLite 连接上下文（包含 Drizzle + 原始 sql.js 实例） */
export async function createSqliteContext(dbPath?: string): Promise<SqliteContext> {
  try {
    const resolvedPath = resolveDbPath(dbPath);
    const dir = path.dirname(resolvedPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs({
      locateFile: (file: string) => resolveWasmPath(file),
    });

    let sqlite: SqlJsDatabase;
    if (fs.existsSync(resolvedPath)) {
      const buf = fs.readFileSync(resolvedPath);
      sqlite = new SQL.Database(buf);
    } else {
      sqlite = new SQL.Database();
    }

    sqlite.run('PRAGMA foreign_keys = ON');
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
      err,
    );
  }
}

/** 创建 sql.js 连接并初始化 Drizzle（向后兼容） */
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
  market_cap REAL NOT NULL, pe_ttm REAL NOT NULL, pb REAL NOT NULL,
  ps_ttm REAL NOT NULL, dividend_yield REAL NOT NULL,
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
`;

/** 执行建表迁移 + 增量 ALTER TABLE（兼容已有库） */
function runMigrations(db: SqlJsDatabase): void {
  db.run(DDL);
  // 增量迁移：为已有表添加新列
  // SQLite 不支持 IF NOT EXISTS for ALTER TABLE，用 try/catch 处理列已存在的情况
  const alterStatements = [
    'ALTER TABLE instruments ADD COLUMN attributes TEXT',
    'ALTER TABLE trading_calendars ADD COLUMN session_type TEXT',
  ];
  for (const sql of alterStatements) {
    try {
      db.run(sql);
    } catch {
      // 列已存在，忽略错误（SQLite 会抛出 "duplicate column name"）
    }
  }
}

/** 获取底层 sql.js Database 实例 */
export async function createRawSqlJs(dbPath?: string): Promise<SqlJsDatabase> {
  const resolvedPath = resolveDbPath(dbPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const SQL = await initSqlJs({
    locateFile: (file: string) => {
      const wasmPath = path.resolve(process.cwd(), 'node_modules', 'sql.js', 'dist', file);
      if (fs.existsSync(wasmPath)) return wasmPath;
      const parentPath = path.resolve(process.cwd(), '..', 'node_modules', 'sql.js', 'dist', file);
      if (fs.existsSync(parentPath)) return parentPath;
      return `https://sql.js.org/dist/${file}`;
    },
  });

  if (fs.existsSync(resolvedPath)) {
    const buf = fs.readFileSync(resolvedPath);
    return new SQL.Database(buf);
  }
  return new SQL.Database();
}

/** 将内存数据库持久化到文件 */
export function saveDbToFile(db: SqlJsDatabase, dbPath?: string): void {
  const resolvedPath = resolveDbPath(dbPath);
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  try {
    const data = db.export();
    fs.writeFileSync(resolvedPath, Buffer.from(data));
  } catch (err) {
    throw new WriteError(
      `持久化数据库到文件失败: ${resolvedPath}`,
      err,
    );
  }
}
