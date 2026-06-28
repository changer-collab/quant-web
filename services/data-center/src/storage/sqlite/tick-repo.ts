/**
 * Tick Repository — SQLite (better-sqlite3) 实现
 */
import { eq, and, gte, lte, gt, desc } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { ticks } from '../schema.js';
import type { TickRepository, PageParams, PageResult } from '../../repository/types.js';
import type { ExtendedTick } from '../../market/types.js';
import { WriteError, QueryError } from '../../errors.js';

function toRow(tick: ExtendedTick) {
  return {
    symbol: tick.symbol,
    timestamp: tick.timestamp,
    price: tick.price,
    volume: tick.volume,
    bid: tick.bid,
    ask: tick.ask,
    bidVolume: tick.bidVolume,
    askVolume: tick.askVolume,
    bidOrders: tick.bidOrders ?? null,
    askOrders: tick.askOrders ?? null,
  };
}

function toModel(row: typeof ticks.$inferSelect): ExtendedTick {
  return {
    symbol: row.symbol,
    timestamp: row.timestamp,
    price: row.price,
    volume: row.volume,
    bid: row.bid,
    ask: row.ask,
    bidVolume: row.bidVolume,
    askVolume: row.askVolume,
    ...(row.bidOrders != null && { bidOrders: row.bidOrders }),
    ...(row.askOrders != null && { askOrders: row.askOrders }),
  };
}

export class SqliteTickRepository implements TickRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: ExtendedTick[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const tick of input) {
          const row = toRow(tick);
          tx.insert(ticks)
            .values(row)
            .onConflictDoUpdate({
              target: [ticks.symbol, ticks.timestamp],
              set: row,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存 Tick 失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number): Promise<ExtendedTick[]> {
    try {
      const conditions = [eq(ticks.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(ticks.timestamp, start));
      if (end !== undefined) conditions.push(lte(ticks.timestamp, end));
      const rows = await this.db.select().from(ticks)
        .where(and(...conditions))
        .orderBy(ticks.timestamp);
      return rows.map(toModel);
    } catch (err) {
      throw new QueryError(`查询 Tick 失败: ${symbol}`, err);
    }
  }

  async getLatest(symbol: string): Promise<ExtendedTick | undefined> {
    try {
      const rows = await this.db.select().from(ticks)
        .where(eq(ticks.symbol, symbol))
        .orderBy(desc(ticks.timestamp))
        .limit(1);
      return rows.length > 0 ? toModel(rows[0]) : undefined;
    } catch (err) {
      throw new QueryError(`查询最新 Tick 失败: ${symbol}`, err);
    }
  }

  async queryPaged(symbol: string, params?: PageParams): Promise<PageResult<ExtendedTick>> {
    try {
      const limit = params?.limit ?? 1000;
      const conditions = [eq(ticks.symbol, symbol)];
      if (params?.afterTimestamp !== undefined) {
        conditions.push(gt(ticks.timestamp, params.afterTimestamp));
      }
      const rows = await this.db.select().from(ticks)
        .where(and(...conditions))
        .orderBy(ticks.timestamp)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map(toModel);
      return {
        data,
        hasMore,
        nextCursor: hasMore && data.length > 0 ? data[data.length - 1].timestamp : undefined,
      };
    } catch (err) {
      throw new QueryError(`分页查询 Tick 失败: ${symbol}`, err);
    }
  }
}
