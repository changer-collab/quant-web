import { eq, and, desc, sql, type SQL } from 'drizzle-orm';
import { getApiDb } from './connection.js';
import { backtestReports } from './schema.js';
import type { BacktestReport, BacktestReportSummary, ReportFilter } from '../types.js';

type ReportRow = typeof backtestReports.$inferSelect;

function rowToSummary(row: ReportRow): BacktestReportSummary {
  return {
    id: row.id,
    taskId: row.taskId,
    strategyName: row.strategyName,
    symbol: row.symbol,
    timeframe: row.timeframe,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    createdAt: row.createdAt,
    totalReturn: row.totalReturn,
    annualizedReturn: row.annualizedReturn,
    sharpeRatio: row.sharpeRatio,
    maxDrawdown: row.maxDrawdown,
    winRate: row.winRate,
    totalTrades: row.totalTrades,
  };
}

function rowToReport(row: ReportRow): BacktestReport {
  return {
    ...rowToSummary(row),
    reportData: JSON.parse(row.reportData),
  };
}

export class ReportRepository {
  async save(report: BacktestReport): Promise<void> {
    const db = getApiDb();
    const row = {
      id: report.id,
      taskId: report.taskId,
      strategyName: report.strategyName,
      symbol: report.symbol,
      timeframe: report.timeframe,
      startTime: report.startTime ?? null,
      endTime: report.endTime ?? null,
      createdAt: report.createdAt,
      totalReturn: report.totalReturn,
      annualizedReturn: report.annualizedReturn,
      sharpeRatio: report.sharpeRatio,
      maxDrawdown: report.maxDrawdown,
      winRate: report.winRate,
      totalTrades: report.totalTrades,
      reportData: JSON.stringify(report.reportData),
    };

    await db.insert(backtestReports).values(row).onConflictDoUpdate({
      target: backtestReports.id,
      set: row,
    }).execute();
  }

  async getById(id: string): Promise<BacktestReport | undefined> {
    const db = getApiDb();
    const rows = await db.select().from(backtestReports).where(eq(backtestReports.id, id)).execute();
    return rows[0] ? rowToReport(rows[0]) : undefined;
  }

  async list(filter?: ReportFilter): Promise<BacktestReportSummary[]> {
    const db = getApiDb();
    const conditions: SQL[] = [];

    if (filter?.strategyName) {
      conditions.push(eq(backtestReports.strategyName, filter.strategyName));
    }
    if (filter?.symbol) {
      conditions.push(eq(backtestReports.symbol, filter.symbol));
    }
    if (filter?.startTime !== undefined) {
      conditions.push(sql`${backtestReports.createdAt} >= ${filter.startTime}`);
    }
    if (filter?.endTime !== undefined) {
      conditions.push(sql`${backtestReports.createdAt} <= ${filter.endTime}`);
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let query = db.select().from(backtestReports);
    if (where) {
      query = query.where(where) as typeof query;
    }

    const rows = await query
      .orderBy(desc(backtestReports.createdAt))
      .limit(filter?.limit ?? 100)
      .offset(filter?.offset ?? 0)
      .execute();

    return rows.map(rowToSummary);
  }

  async delete(id: string): Promise<void> {
    const db = getApiDb();
    await db.delete(backtestReports).where(eq(backtestReports.id, id)).execute();
  }

  async count(filter?: ReportFilter): Promise<number> {
    const db = getApiDb();
    const conditions: SQL[] = [];

    if (filter?.strategyName) {
      conditions.push(eq(backtestReports.strategyName, filter.strategyName));
    }
    if (filter?.symbol) {
      conditions.push(eq(backtestReports.symbol, filter.symbol));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let query = db.select({ count: sql<number>`count(*)` }).from(backtestReports);
    if (where) {
      query = query.where(where) as typeof query;
    }

    const result = await query.execute();
    return Number(result[0]?.count ?? 0);
  }
}