/**
 * L2 行情 Repository — SQLite (better-sqlite3) 实现
 */
import { eq, and, gte, lte, gt, desc } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { l2Snapshots, tradeRecords, orderRecords } from '../schema.js';
import type {
  Level2SnapshotRepository,
  TradeRecordRepository,
  OrderRecordRepository,
  PageParams,
  PageResult,
} from '../../repository/types.js';
import type { Level2Snapshot, OrderBookEntry, TradeRecord, OrderRecord } from '../../l2/types.js';
import { TradeSide, TradeType, OrderAction, L2OrderType } from '../../l2/types.js';
import { WriteError, QueryError } from '../../errors.js';

// ─── 盘口快照 ───────────────────────────────────────────

export class SqliteLevel2SnapshotRepository implements Level2SnapshotRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: Level2Snapshot[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const s of input) {
          const row = {
            symbol: s.symbol,
            timestamp: s.timestamp,
            bids: JSON.stringify(s.bids),
            asks: JSON.stringify(s.asks),
          };
          tx.insert(l2Snapshots)
            .values(row)
            .onConflictDoUpdate({
              target: [l2Snapshots.symbol, l2Snapshots.timestamp],
              set: row,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存盘口快照失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number): Promise<Level2Snapshot[]> {
    try {
      const conditions = [eq(l2Snapshots.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(l2Snapshots.timestamp, start));
      if (end !== undefined) conditions.push(lte(l2Snapshots.timestamp, end));
      const rows = await this.db
        .select()
        .from(l2Snapshots)
        .where(and(...conditions))
        .orderBy(l2Snapshots.timestamp);
      return rows.map((r) => ({
        symbol: r.symbol,
        timestamp: r.timestamp,
        bids: JSON.parse(r.bids) as OrderBookEntry[],
        asks: JSON.parse(r.asks) as OrderBookEntry[],
      }));
    } catch (err) {
      throw new QueryError(`查询盘口快照失败: ${symbol}`, err);
    }
  }

  async getLatest(symbol: string): Promise<Level2Snapshot | undefined> {
    try {
      const rows = await this.db
        .select()
        .from(l2Snapshots)
        .where(eq(l2Snapshots.symbol, symbol))
        .orderBy(desc(l2Snapshots.timestamp))
        .limit(1);
      if (rows.length === 0) return undefined;
      const row = rows[0];
      return {
        symbol: row.symbol,
        timestamp: row.timestamp,
        bids: JSON.parse(row.bids) as OrderBookEntry[],
        asks: JSON.parse(row.asks) as OrderBookEntry[],
      };
    } catch (err) {
      throw new QueryError(`查询最新盘口快照失败: ${symbol}`, err);
    }
  }

  async queryPaged(symbol: string, params?: PageParams): Promise<PageResult<Level2Snapshot>> {
    try {
      const limit = params?.limit ?? 1000;
      const conditions = [eq(l2Snapshots.symbol, symbol)];
      if (params?.afterTimestamp !== undefined) {
        conditions.push(gt(l2Snapshots.timestamp, params.afterTimestamp));
      }
      const rows = await this.db
        .select()
        .from(l2Snapshots)
        .where(and(...conditions))
        .orderBy(l2Snapshots.timestamp)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map((r) => ({
        symbol: r.symbol,
        timestamp: r.timestamp,
        bids: JSON.parse(r.bids) as OrderBookEntry[],
        asks: JSON.parse(r.asks) as OrderBookEntry[],
      }));
      return {
        data,
        hasMore,
        nextCursor: hasMore && data.length > 0 ? data[data.length - 1].timestamp : undefined,
      };
    } catch (err) {
      throw new QueryError(`分页查询盘口快照失败: ${symbol}`, err);
    }
  }
}

// ─── 逐笔成交 ───────────────────────────────────────────

export class SqliteTradeRecordRepository implements TradeRecordRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: TradeRecord[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const t of input) {
          tx.insert(tradeRecords)
            .values({
              symbol: t.symbol,
              timestamp: t.timestamp,
              price: t.price,
              volume: t.volume,
              side: t.side,
              tradeType: t.tradeType,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存逐笔成交失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number): Promise<TradeRecord[]> {
    try {
      const conditions = [eq(tradeRecords.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(tradeRecords.timestamp, start));
      if (end !== undefined) conditions.push(lte(tradeRecords.timestamp, end));
      const rows = await this.db
        .select()
        .from(tradeRecords)
        .where(and(...conditions))
        .orderBy(tradeRecords.timestamp);
      return rows.map((r) => ({
        symbol: r.symbol,
        timestamp: r.timestamp,
        price: r.price,
        volume: r.volume,
        side: r.side as TradeSide,
        tradeType: r.tradeType as TradeType,
      }));
    } catch (err) {
      throw new QueryError(`查询逐笔成交失败: ${symbol}`, err);
    }
  }

  async queryPaged(symbol: string, params?: PageParams): Promise<PageResult<TradeRecord>> {
    try {
      const limit = params?.limit ?? 1000;
      const conditions = [eq(tradeRecords.symbol, symbol)];
      if (params?.afterTimestamp !== undefined) {
        conditions.push(gt(tradeRecords.timestamp, params.afterTimestamp));
      }
      const rows = await this.db
        .select()
        .from(tradeRecords)
        .where(and(...conditions))
        .orderBy(tradeRecords.timestamp)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map((r) => ({
        symbol: r.symbol,
        timestamp: r.timestamp,
        price: r.price,
        volume: r.volume,
        side: r.side as TradeSide,
        tradeType: r.tradeType as TradeType,
      }));
      return {
        data,
        hasMore,
        nextCursor: hasMore && data.length > 0 ? data[data.length - 1].timestamp : undefined,
      };
    } catch (err) {
      throw new QueryError(`分页查询逐笔成交失败: ${symbol}`, err);
    }
  }
}

// ─── 逐笔委托 ───────────────────────────────────────────

export class SqliteOrderRecordRepository implements OrderRecordRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: OrderRecord[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const o of input) {
          tx.insert(orderRecords)
            .values({
              symbol: o.symbol,
              timestamp: o.timestamp,
              price: o.price,
              volume: o.volume,
              action: o.action,
              orderType: o.orderType,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存逐笔委托失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number): Promise<OrderRecord[]> {
    try {
      const conditions = [eq(orderRecords.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(orderRecords.timestamp, start));
      if (end !== undefined) conditions.push(lte(orderRecords.timestamp, end));
      const rows = await this.db
        .select()
        .from(orderRecords)
        .where(and(...conditions))
        .orderBy(orderRecords.timestamp);
      return rows.map((r) => ({
        symbol: r.symbol,
        timestamp: r.timestamp,
        price: r.price,
        volume: r.volume,
        action: r.action as OrderAction,
        orderType: r.orderType as L2OrderType,
      }));
    } catch (err) {
      throw new QueryError(`查询逐笔委托失败: ${symbol}`, err);
    }
  }

  async queryPaged(symbol: string, params?: PageParams): Promise<PageResult<OrderRecord>> {
    try {
      const limit = params?.limit ?? 1000;
      const conditions = [eq(orderRecords.symbol, symbol)];
      if (params?.afterTimestamp !== undefined) {
        conditions.push(gt(orderRecords.timestamp, params.afterTimestamp));
      }
      const rows = await this.db
        .select()
        .from(orderRecords)
        .where(and(...conditions))
        .orderBy(orderRecords.timestamp)
        .limit(limit + 1);

      const hasMore = rows.length > limit;
      const data = rows.slice(0, limit).map((r) => ({
        symbol: r.symbol,
        timestamp: r.timestamp,
        price: r.price,
        volume: r.volume,
        action: r.action as OrderAction,
        orderType: r.orderType as L2OrderType,
      }));
      return {
        data,
        hasMore,
        nextCursor: hasMore && data.length > 0 ? data[data.length - 1].timestamp : undefined,
      };
    } catch (err) {
      throw new QueryError(`分页查询逐笔委托失败: ${symbol}`, err);
    }
  }
}
