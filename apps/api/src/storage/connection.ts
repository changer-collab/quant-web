/**
 * SQLite 连接管理 — better-sqlite3 实现（原生预编译二进制，零本地编译）
 *
 * 与 services/data-center 保持一致的 better-sqlite3 驱动方案。
 *
 * 默认路径：项目根目录 data/api.db
 * 可通过参数覆盖。
 *
 * 注意：better-sqlite3 直接读写磁盘，写入即持久化；close() 释放文件句柄。
 */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';

export type ApiDb = BetterSQLite3Database<typeof schema>;

let db: ApiDb | null = null;
let sqlite: Database.Database | null = null;
let currentDbPath: string | null = null;

export async function initApiDb(dbPath?: string): Promise<ApiDb> {
  if (db) return db;

  const resolvedPath = dbPath ?? resolve(process.cwd(), 'data', 'api.db');
  const dir = dirname(resolvedPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  sqlite = new Database(resolvedPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  currentDbPath = resolvedPath;

  // 创建表
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS backtest_reports (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      strategy_name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      timeframe TEXT NOT NULL,
      start_time INTEGER,
      end_time INTEGER,
      created_at INTEGER NOT NULL,
      total_return REAL NOT NULL,
      annualized_return REAL NOT NULL,
      sharpe_ratio REAL NOT NULL,
      max_drawdown REAL NOT NULL,
      win_rate REAL NOT NULL,
      total_trades INTEGER NOT NULL,
      report_data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reports_strategy ON backtest_reports(strategy_name);
    CREATE INDEX IF NOT EXISTS idx_reports_symbol ON backtest_reports(symbol);
    CREATE INDEX IF NOT EXISTS idx_reports_created ON backtest_reports(created_at);

    CREATE TABLE IF NOT EXISTS factor_evaluations (
      id TEXT PRIMARY KEY,
      factor_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      ic_mean REAL,
      ic_std REAL,
      rank_ic_mean REAL,
      rank_ic_std REAL,
      icir REAL,
      rank_icir REAL,
      group_returns TEXT,
      eval_data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evals_factor ON factor_evaluations(factor_id);
    CREATE INDEX IF NOT EXISTS idx_evals_created ON factor_evaluations(created_at);
  `);

  db = drizzle(sqlite, { schema });
  return db;
}

export function getApiDb(): ApiDb {
  if (!db) {
    throw new Error('API database not initialized. Call initApiDb() first.');
  }
  return db;
}

/**
 * 关闭数据库连接。
 * @param persist 是否在关闭前做 WAL 检查点（默认 true）。
 *                better-sqlite3 写入即落盘，此参数仅控制是否合并 WAL；
 *                保留签名以兼容测试调用（closeApiDb(false)）。
 */
export function closeApiDb(persist = true): void {
  if (sqlite) {
    if (persist && currentDbPath) {
      try {
        sqlite.pragma('wal_checkpoint(TRUNCATE)');
      } catch {
        // 检查点失败不阻断关闭
      }
    }
    sqlite.close();
    sqlite = null;
    db = null;
    currentDbPath = null;
  }
}
