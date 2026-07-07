/**
 * 扩展数据 Repository — SQLite (better-sqlite3) 实现
 *
 * external_records 表是通用载体，承载尚未独立建表的数据类型：
 * dragon_tiger / lockup / margin / block_trade / dividend /
 * research_report / hot_stocks / northbound_flow / f10 / factor_result 等
 */
import { eq, and, gte, lte } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { externalRecords } from '../schema.js';
import type {
  ExternalRecordRepository,
  ExternalRecord,
  ExternalRecordQuery,
} from '../../repository/types.js';
import { WriteError, QueryError } from '../../errors.js';

export class SqliteExternalRecordRepository implements ExternalRecordRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: ExternalRecord[]): Promise<void> {
    if (input.length === 0) return;
    try {
      this.db.transaction((tx) => {
        for (const r of input) {
          const row = {
            id: r.id,
            dataType: r.dataType,
            symbol: r.symbol,
            timestamp: r.timestamp,
            payload: JSON.stringify(r.payload),
            source: r.source,
          };
          tx.insert(externalRecords)
            .values(row)
            .onConflictDoUpdate({
              target: [externalRecords.id],
              set: row,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存扩展数据失败: ${input[0]?.dataType}`, err);
    }
  }

  async query(params: ExternalRecordQuery): Promise<ExternalRecord[]> {
    try {
      const conditions = [eq(externalRecords.dataType, params.dataType)];
      if (params.symbol !== undefined) conditions.push(eq(externalRecords.symbol, params.symbol));
      if (params.start !== undefined) conditions.push(gte(externalRecords.timestamp, params.start));
      if (params.end !== undefined) conditions.push(lte(externalRecords.timestamp, params.end));
      const limit = params.limit ?? 1000;
      const rows = await this.db
        .select()
        .from(externalRecords)
        .where(and(...conditions))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        dataType: r.dataType,
        symbol: r.symbol,
        timestamp: r.timestamp,
        payload: JSON.parse(r.payload) as Record<string, unknown>,
        source: r.source,
      }));
    } catch (err) {
      throw new QueryError(`查询扩展数据失败: ${params.dataType}`, err);
    }
  }

  async deleteByType(dataType: string, symbol?: string): Promise<void> {
    try {
      const conditions = [eq(externalRecords.dataType, dataType)];
      if (symbol !== undefined) conditions.push(eq(externalRecords.symbol, symbol));
      this.db.delete(externalRecords).where(and(...conditions)).run();
    } catch (err) {
      throw new WriteError(`删除扩展数据失败: ${dataType}`, err);
    }
  }
}
