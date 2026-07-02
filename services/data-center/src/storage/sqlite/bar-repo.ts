/**
 * K 线 Repository — SQLite (better-sqlite3) 实现
 */
import { eq, and, gte, lte, gt, desc, sql } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { bars } from '../schema.js';
import type { BarRepository, PageParams, PageResult } from '../../repository/types.js';
import type { TimeFrame } from '../../base/types.js';
import type { ExtendedBar } from '../../market/types.js';
import { WriteError, QueryError } from '../../errors.js';

function toRow(bar: ExtendedBar) {
  return {
    symbol: bar.symbol,
    timeframe: bar.timeframe,
    timestamp: bar.timestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    turnover: bar.turnover,
    openInterest: bar.openInterest ?? null,
    numTrades: bar.numTrades ?? null,
  };
}

function toModel(row: typeof bars.$inferSelect): ExtendedBar {
  return {
    symbol: row.symbol,
    timeframe: row.timeframe as TimeFrame,
    timestamp: row.timestamp,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    turnover: row.turnover,
    ...(row.openInterest != null && { openInterest: row.openInterest }),
    ...(row.numTrades != null && { numTrades: row.numTrades }),
  };
}

export class SqliteBarRepository implements BarRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: ExtendedBar[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const bar of input) {
          const row = toRow(bar);
          tx.insert(bars)
            .values(row)
            .onConflictDoUpdate({
              target: [bars.symbol, bars.timeframe, bars.timestamp],
              set: row,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存 K 线失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(
    symbol: string,
    timeframe: TimeFrame,
    start?: number,
    end?: number
  ): Promise<ExtendedBar[]> {
    try {
      const conditions = [eq(bars.symbol, symbol), eq(bars.timeframe, timeframe)];
      if (start !== undefined) conditions.push(gte(bars.timestamp, start));
      if (end !== undefined) conditions.push(lte(bars.timestamp, end));
      const rows = await this.db
        .select()
        .from(bars)
        .where(and(...conditions))
        .orderBy(bars.timestamp);
      return rows.map(toModel);
    } catch (err) {
      throw new QueryError(`查询 K 线失败: ${symbol}/${timeframe}`, err);
    }
  }

  async getLatest(symbol: string, timeframe: TimeFrame): Promise<ExtendedBar | undefined> {
    try {
      const rows = await this.db
        .select()
        .from(bars)
        .where(and(eq(bars.symbol, symbol), eq(bars.timeframe, timeframe)))
        .orderBy(desc(bars.timestamp))
        .limit(1);
      return rows.length > 0 ? toModel(rows[0]) : undefined;
    } catch (err) {
      throw new QueryError(`查询最新 K 线失败: ${symbol}/${timeframe}`, err);
    }
  }

  async getAvailableSymbols(timeframe?: TimeFrame): Promise<string[]> {
    try {
      const conditions = timeframe ? [eq(bars.timeframe, timeframe)] : [];
      const rows = await this.db
        .selectDistinct({ symbol: bars.symbol })
        .from(bars)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return rows.map((r) => r.symbol);
    } catch (err) {
      throw new QueryError('查询可用标的失败', err);
    }
  }

  async count(symbol: string, timeframe: TimeFrame, start?: number, end?: number): Promise<number> {
    try {
      const conditions = [eq(bars.symbol, symbol), eq(bars.timeframe, timeframe)];
      if (start !== undefined) conditions.push(gte(bars.timestamp, start));
      if (end !== undefined) conditions.push(lte(bars.timestamp, end));
      const result = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(bars)
        .where(and(...conditions));
      return result[0]?.count ?? 0;
    } catch (err) {
      throw new QueryError(`统计 K 线数量失败: ${symbol}/${timeframe}`, err);
    }
  }

  async queryPaged(
    symbol: string,
    timeframe: TimeFrame,
    params?: PageParams
  ): Promise<PageResult<ExtendedBar>> {
    try {
      const limit = params?.limit ?? 1000;
      const conditions = [eq(bars.symbol, symbol), eq(bars.timeframe, timeframe)];
      if (params?.afterTimestamp !== undefined) {
        conditions.push(gt(bars.timestamp, params.afterTimestamp));
      }
      // 多取 1 条判断 hasMore
      const rows = await this.db
        .select()
        .from(bars)
        .where(and(...conditions))
        .orderBy(bars.timestamp)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map(toModel);
      return {
        data,
        hasMore,
        nextCursor: hasMore && data.length > 0 ? data[data.length - 1].timestamp : undefined,
      };
    } catch (err) {
      throw new QueryError(`分页查询 K 线失败: ${symbol}/${timeframe}`, err);
    }
  }
}
