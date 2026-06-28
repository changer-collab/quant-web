/**
 * 水位 Repository — SQLite (better-sqlite3) 实现
 */
import { eq, and } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { watermarks } from '../schema.js';
import type { WatermarkRepository, Watermark } from '../../repository/types.js';
import { WriteError, QueryError } from '../../errors.js';

export class SqliteWatermarkRepository implements WatermarkRepository {
  constructor(private db: DrizzleDb) {}

  async get(source: string, dataType: string, symbol: string): Promise<Watermark | undefined> {
    try {
      const rows = await this.db.select().from(watermarks)
        .where(and(
          eq(watermarks.source, source),
          eq(watermarks.dataType, dataType),
          eq(watermarks.symbol, symbol),
        ))
        .limit(1);
      if (rows.length === 0) return undefined;
      const r = rows[0];
      return {
        source: r.source,
        dataType: r.dataType,
        symbol: r.symbol,
        lastTimestamp: r.lastTimestamp,
        updatedAt: r.updatedAt,
      };
    } catch (err) {
      throw new QueryError(`查询水位失败: ${source}/${dataType}/${symbol}`, err);
    }
  }

  async upsert(wm: Watermark): Promise<void> {
    try {
      const row = {
        source: wm.source,
        dataType: wm.dataType,
        symbol: wm.symbol,
        lastTimestamp: wm.lastTimestamp,
        updatedAt: wm.updatedAt,
      };
      await this.db.insert(watermarks)
        .values(row)
        .onConflictDoUpdate({
          target: [watermarks.source, watermarks.dataType, watermarks.symbol],
          set: row,
        });
    } catch (err) {
      throw new WriteError(`保存水位失败: ${wm.source}/${wm.dataType}/${wm.symbol}`, err);
    }
  }

  async list(source: string, dataType?: string): Promise<Watermark[]> {
    try {
      const conditions = [eq(watermarks.source, source)];
      if (dataType !== undefined) conditions.push(eq(watermarks.dataType, dataType));
      const rows = await this.db.select().from(watermarks)
        .where(and(...conditions));
      return rows.map((r) => ({
        source: r.source,
        dataType: r.dataType,
        symbol: r.symbol,
        lastTimestamp: r.lastTimestamp,
        updatedAt: r.updatedAt,
      }));
    } catch (err) {
      throw new QueryError(`查询水位列表失败: ${source}`, err);
    }
  }
}
