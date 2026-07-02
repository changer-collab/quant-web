/**
 * 参考数据 Repository — SQLite (better-sqlite3) 实现
 */
import { eq, and, gte, lte } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { instruments, tradingCalendars, indexConstituents, adjustmentFactors } from '../schema.js';
import type {
  InstrumentRepository,
  CalendarRepository,
  IndexCompositionRepository,
  AdjustmentFactorRepository,
} from '../../repository/types.js';
import type {
  ExtendedInstrument,
  TradingCalendar,
  IndexComposition,
  AdjustmentFactor,
  ReferenceQuery,
} from '../../reference/types.js';
import { InstrumentStatus } from '../../reference/types.js';
import { AdjustmentType } from '../../reference/types.js';
import { WriteError, QueryError } from '../../errors.js';

// ─── 标的 ───────────────────────────────────────────────

function instrumentToRow(inst: ExtendedInstrument) {
  return {
    symbol: inst.symbol,
    name: inst.name,
    exchange: inst.exchange,
    lotSize: inst.lotSize,
    priceTick: inst.priceTick,
    industry: inst.industry,
    sector: inst.sector,
    listDate: inst.listDate,
    delistDate: inst.delistDate ?? null,
    status: inst.status,
    attributes: inst.attributes ? JSON.stringify(inst.attributes) : null,
  };
}

function instrumentToModel(row: typeof instruments.$inferSelect): ExtendedInstrument {
  return {
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    lotSize: row.lotSize,
    priceTick: row.priceTick,
    industry: row.industry,
    sector: row.sector,
    listDate: row.listDate,
    ...(row.delistDate != null && { delistDate: row.delistDate }),
    status: row.status as InstrumentStatus,
    ...(row.attributes != null && { attributes: JSON.parse(row.attributes) }),
  };
}

export class SqliteInstrumentRepository implements InstrumentRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: ExtendedInstrument[]): Promise<void> {
    try {
      this.db.transaction((tx) => {
        for (const inst of input) {
          const row = instrumentToRow(inst);
          tx.insert(instruments)
            .values(row)
            .onConflictDoUpdate({ target: instruments.symbol, set: row })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存标的失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(query?: ReferenceQuery): Promise<ExtendedInstrument[]> {
    try {
      const conditions = [];
      if (query?.exchange) conditions.push(eq(instruments.exchange, query.exchange));
      if (query?.status) conditions.push(eq(instruments.status, query.status));
      if (query?.industry) conditions.push(eq(instruments.industry, query.industry));
      if (query?.sector) conditions.push(eq(instruments.sector, query.sector));
      const rows = await this.db
        .select()
        .from(instruments)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      return rows.map(instrumentToModel);
    } catch (err) {
      throw new QueryError('查询标的失败', err);
    }
  }

  async getBySymbol(symbol: string): Promise<ExtendedInstrument | undefined> {
    try {
      const rows = await this.db
        .select()
        .from(instruments)
        .where(eq(instruments.symbol, symbol))
        .limit(1);
      return rows.length > 0 ? instrumentToModel(rows[0]) : undefined;
    } catch (err) {
      throw new QueryError(`查询标的失败: ${symbol}`, err);
    }
  }
}

// ─── 交易日历 ───────────────────────────────────────────

export class SqliteCalendarRepository implements CalendarRepository {
  constructor(private db: DrizzleDb) {}

  async save(calendar: TradingCalendar): Promise<void> {
    try {
      const row = {
        exchange: calendar.exchange,
        year: calendar.year,
        tradingDays: JSON.stringify(calendar.tradingDays),
        holidays: JSON.stringify(calendar.holidays),
        sessionType: calendar.sessionType ?? null,
      };
      await this.db
        .insert(tradingCalendars)
        .values(row)
        .onConflictDoUpdate({
          target: [tradingCalendars.exchange, tradingCalendars.year],
          set: row,
        });
    } catch (err) {
      throw new WriteError(`保存交易日历失败: ${calendar.exchange}/${calendar.year}`, err);
    }
  }

  async get(exchange: string, year: number): Promise<TradingCalendar | undefined> {
    try {
      const rows = await this.db
        .select()
        .from(tradingCalendars)
        .where(and(eq(tradingCalendars.exchange, exchange), eq(tradingCalendars.year, year)))
        .limit(1);
      if (rows.length === 0) return undefined;
      const row = rows[0];
      return {
        exchange: row.exchange,
        year: row.year,
        tradingDays: JSON.parse(row.tradingDays),
        holidays: JSON.parse(row.holidays),
        ...(row.sessionType != null && { sessionType: row.sessionType }),
      };
    } catch (err) {
      throw new QueryError(`查询交易日历失败: ${exchange}/${year}`, err);
    }
  }
}

// ─── 指数成分 ───────────────────────────────────────────

export class SqliteIndexCompositionRepository implements IndexCompositionRepository {
  constructor(private db: DrizzleDb) {}

  async save(composition: IndexComposition): Promise<void> {
    try {
      this.db.transaction((tx) => {
        for (const c of composition.constituents) {
          tx.insert(indexConstituents)
            .values({
              indexSymbol: composition.indexSymbol,
              asOfDate: composition.asOfDate,
              symbol: c.symbol,
              weight: c.weight,
            })
            .onConflictDoUpdate({
              target: [
                indexConstituents.indexSymbol,
                indexConstituents.asOfDate,
                indexConstituents.symbol,
              ],
              set: { weight: c.weight },
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存指数成分失败: ${composition.indexSymbol}`, err);
    }
  }

  async get(indexSymbol: string, asOfDate: number): Promise<IndexComposition | undefined> {
    try {
      const rows = await this.db
        .select()
        .from(indexConstituents)
        .where(
          and(
            eq(indexConstituents.indexSymbol, indexSymbol),
            eq(indexConstituents.asOfDate, asOfDate)
          )
        );
      if (rows.length === 0) return undefined;
      return {
        indexSymbol,
        asOfDate,
        constituents: rows.map((r) => ({ symbol: r.symbol, weight: r.weight })),
      };
    } catch (err) {
      throw new QueryError(`查询指数成分失败: ${indexSymbol}/${asOfDate}`, err);
    }
  }
}

// ─── 复权因子 ───────────────────────────────────────────

export class SqliteAdjustmentFactorRepository implements AdjustmentFactorRepository {
  constructor(private db: DrizzleDb) {}

  async save(factors: AdjustmentFactor[]): Promise<void> {
    try {
      this.db.transaction((tx) => {
        for (const f of factors) {
          const row = { symbol: f.symbol, date: f.date, factor: f.factor, type: f.type };
          tx.insert(adjustmentFactors)
            .values(row)
            .onConflictDoUpdate({
              target: [adjustmentFactors.symbol, adjustmentFactors.date],
              set: row,
            })
            .run();
        }
      });
    } catch (err) {
      throw new WriteError(`保存复权因子失败: ${factors[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number): Promise<AdjustmentFactor[]> {
    try {
      const conditions = [eq(adjustmentFactors.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(adjustmentFactors.date, start));
      if (end !== undefined) conditions.push(lte(adjustmentFactors.date, end));
      const rows = await this.db
        .select()
        .from(adjustmentFactors)
        .where(and(...conditions))
        .orderBy(adjustmentFactors.date);
      return rows.map((r) => ({
        symbol: r.symbol,
        date: r.date,
        factor: r.factor,
        type: r.type as AdjustmentType,
      }));
    } catch (err) {
      throw new QueryError(`查询复权因子失败: ${symbol}`, err);
    }
  }
}
