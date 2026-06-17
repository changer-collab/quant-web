/**
 * 基本面 Repository — SQLite (sql.js) 实现
 */
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import {
  financialReports,
  financialRatios,
  valuations,
  shareholderMetrics,
} from '../schema.js';
import type {
  FinancialReportRepository,
  FinancialRatioRepository,
  ValuationRepository,
  ShareholderMetricsRepository,
} from '../../repository/types.js';
import type {
  FinancialReport,
  FinancialRatio,
  ValuationPoint,
  ShareholderMetrics,
} from '../../fundamental/types.js';
import { ReportType } from '../../fundamental/types.js';
import { WriteError, QueryError } from '../../errors.js';

// ─── 财报 ───────────────────────────────────────────────

function reportToRow(r: FinancialReport) {
  return {
    symbol: r.symbol,
    reportDate: r.reportDate,
    announceDate: r.announceDate,
    reportType: r.reportType,
    revenue: r.income.revenue,
    costOfRevenue: r.income.costOfRevenue,
    operatingIncome: r.income.operatingIncome,
    totalRevenue: r.income.totalRevenue,
    netIncome: r.income.netIncome,
    totalAssets: r.balanceSheet.totalAssets,
    totalLiabilities: r.balanceSheet.totalLiabilities,
    totalEquity: r.balanceSheet.totalEquity,
    currentAssets: r.balanceSheet.currentAssets,
    currentLiabilities: r.balanceSheet.currentLiabilities,
    operatingCashFlow: r.cashFlow.operatingCashFlow,
    investingCashFlow: r.cashFlow.investingCashFlow,
    financingCashFlow: r.cashFlow.financingCashFlow,
    freeCashFlow: r.cashFlow.freeCashFlow,
  };
}

function reportToModel(row: typeof financialReports.$inferSelect): FinancialReport {
  return {
    symbol: row.symbol,
    reportDate: row.reportDate,
    announceDate: row.announceDate,
    reportType: row.reportType as ReportType,
    income: {
      revenue: row.revenue,
      costOfRevenue: row.costOfRevenue,
      operatingIncome: row.operatingIncome,
      totalRevenue: row.totalRevenue,
      netIncome: row.netIncome,
    },
    balanceSheet: {
      totalAssets: row.totalAssets,
      totalLiabilities: row.totalLiabilities,
      totalEquity: row.totalEquity,
      currentAssets: row.currentAssets,
      currentLiabilities: row.currentLiabilities,
    },
    cashFlow: {
      operatingCashFlow: row.operatingCashFlow,
      investingCashFlow: row.investingCashFlow,
      financingCashFlow: row.financingCashFlow,
      freeCashFlow: row.freeCashFlow,
    },
  };
}

export class SqliteFinancialReportRepository implements FinancialReportRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: FinancialReport[]): Promise<void> {
    if (input.length === 0) return;
    try {
      await this.db.transaction(async (tx) => {
        for (const r of input) {
          const row = reportToRow(r);
          await tx.insert(financialReports)
            .values(row)
            .onConflictDoUpdate({
              target: [financialReports.symbol, financialReports.reportDate],
              set: row,
            });
        }
      });
    } catch (err) {
      throw new WriteError(`保存财报失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number, asOfDate?: number): Promise<FinancialReport[]> {
    try {
      const conditions = [eq(financialReports.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(financialReports.announceDate, start));
      if (end !== undefined) conditions.push(lte(financialReports.announceDate, end));
      // PIT 过滤：仅返回 announceDate <= asOfDate 的记录
      if (asOfDate !== undefined) conditions.push(lte(financialReports.announceDate, asOfDate));
      const rows = await this.db.select().from(financialReports)
        .where(and(...conditions))
        .orderBy(financialReports.announceDate);
      return rows.map(reportToModel);
    } catch (err) {
      throw new QueryError(`查询财报失败: ${symbol}`, err);
    }
  }

  async getLatest(symbol: string): Promise<FinancialReport | undefined> {
    try {
      const rows = await this.db.select().from(financialReports)
        .where(eq(financialReports.symbol, symbol))
        .orderBy(desc(financialReports.announceDate))
        .limit(1);
      return rows.length > 0 ? reportToModel(rows[0]) : undefined;
    } catch (err) {
      throw new QueryError(`查询最新财报失败: ${symbol}`, err);
    }
  }
}

// ─── 财务比率 ───────────────────────────────────────────

export class SqliteFinancialRatioRepository implements FinancialRatioRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: FinancialRatio[]): Promise<void> {
    if (input.length === 0) return;
    try {
      await this.db.transaction(async (tx) => {
        for (const r of input) {
          const row = {
            symbol: r.symbol, asOfDate: r.asOfDate,
            roe: r.roe, roa: r.roa, eps: r.eps, pe: r.pe, pb: r.pb, ps: r.ps,
            debtToEquity: r.debtToEquity, currentRatio: r.currentRatio,
            grossMargin: r.grossMargin, netMargin: r.netMargin,
          };
          await tx.insert(financialRatios)
            .values(row)
            .onConflictDoUpdate({
              target: [financialRatios.symbol, financialRatios.asOfDate],
              set: row,
            });
        }
      });
    } catch (err) {
      throw new WriteError(`保存财务比率失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number, asOfDate?: number): Promise<FinancialRatio[]> {
    try {
      const conditions = [eq(financialRatios.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(financialRatios.asOfDate, start));
      if (end !== undefined) conditions.push(lte(financialRatios.asOfDate, end));
      if (asOfDate !== undefined) conditions.push(lte(financialRatios.asOfDate, asOfDate));
      const rows = await this.db.select().from(financialRatios)
        .where(and(...conditions))
        .orderBy(desc(financialRatios.asOfDate));
      return rows.map((r) => ({
        symbol: r.symbol, asOfDate: r.asOfDate,
        roe: r.roe, roa: r.roa, eps: r.eps, pe: r.pe, pb: r.pb, ps: r.ps,
        debtToEquity: r.debtToEquity, currentRatio: r.currentRatio,
        grossMargin: r.grossMargin, netMargin: r.netMargin,
      }));
    } catch (err) {
      throw new QueryError(`查询财务比率失败: ${symbol}`, err);
    }
  }
}

// ─── 估值 ───────────────────────────────────────────────

// ─── 股东人数 ─────────────────────────────────────────────

export class SqliteShareholderMetricsRepository implements ShareholderMetricsRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: ShareholderMetrics[]): Promise<void> {
    if (input.length === 0) return;
    try {
      await this.db.transaction(async (tx) => {
        for (const m of input) {
          const row = {
            symbol: m.symbol,
            announceDate: m.announceDate,
            endDate: m.endDate,
            totalHolders: m.totalHolders,
            avgHoldingShares: m.avgHoldingShares,
            avgHoldingAmount: m.avgHoldingAmount,
            changeRatio: m.changeRatio ?? null,
          };
          await tx.insert(shareholderMetrics)
            .values(row)
            .onConflictDoUpdate({
              target: [shareholderMetrics.symbol, shareholderMetrics.announceDate],
              set: row,
            });
        }
      });
    } catch (err) {
      throw new WriteError(`保存股东人数失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number, asOfDate?: number): Promise<ShareholderMetrics[]> {
    try {
      const conditions = [eq(shareholderMetrics.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(shareholderMetrics.announceDate, start));
      if (end !== undefined) conditions.push(lte(shareholderMetrics.announceDate, end));
      if (asOfDate !== undefined) conditions.push(lte(shareholderMetrics.announceDate, asOfDate));
      const rows = await this.db.select().from(shareholderMetrics)
        .where(and(...conditions))
        .orderBy(shareholderMetrics.announceDate);
      return rows.map((r) => ({
        symbol: r.symbol,
        announceDate: r.announceDate,
        endDate: r.endDate,
        totalHolders: r.totalHolders,
        avgHoldingShares: r.avgHoldingShares,
        avgHoldingAmount: r.avgHoldingAmount,
        ...(r.changeRatio != null && { changeRatio: r.changeRatio }),
      }));
    } catch (err) {
      throw new QueryError(`查询股东人数失败: ${symbol}`, err);
    }
  }

  async getLatest(symbol: string): Promise<ShareholderMetrics | undefined> {
    try {
      const rows = await this.db.select().from(shareholderMetrics)
        .where(eq(shareholderMetrics.symbol, symbol))
        .orderBy(desc(shareholderMetrics.announceDate))
        .limit(1);
      if (rows.length === 0) return undefined;
      const r = rows[0];
      return {
        symbol: r.symbol,
        announceDate: r.announceDate,
        endDate: r.endDate,
        totalHolders: r.totalHolders,
        avgHoldingShares: r.avgHoldingShares,
        avgHoldingAmount: r.avgHoldingAmount,
        ...(r.changeRatio != null && { changeRatio: r.changeRatio }),
      };
    } catch (err) {
      throw new QueryError(`查询最新股东人数失败: ${symbol}`, err);
    }
  }
}

export class SqliteValuationRepository implements ValuationRepository {
  constructor(private db: DrizzleDb) {}

  async save(input: ValuationPoint[]): Promise<void> {
    if (input.length === 0) return;
    try {
      await this.db.transaction(async (tx) => {
        for (const v of input) {
          const row = {
            symbol: v.symbol, timestamp: v.timestamp,
            marketCap: v.marketCap, peTTM: v.peTTM, pb: v.pb,
            psTTM: v.psTTM, dividendYield: v.dividendYield,
            turnoverRate: v.turnoverRate, floatShares: v.floatShares,
          };
          await tx.insert(valuations)
            .values(row)
            .onConflictDoUpdate({
              target: [valuations.symbol, valuations.timestamp],
              set: row,
            });
        }
      });
    } catch (err) {
      throw new WriteError(`保存估值失败: ${input[0]?.symbol}`, err);
    }
  }

  async query(symbol: string, start?: number, end?: number, asOfDate?: number): Promise<ValuationPoint[]> {
    try {
      const conditions = [eq(valuations.symbol, symbol)];
      if (start !== undefined) conditions.push(gte(valuations.timestamp, start));
      if (end !== undefined) conditions.push(lte(valuations.timestamp, end));
      if (asOfDate !== undefined) conditions.push(lte(valuations.timestamp, asOfDate));
      const rows = await this.db.select().from(valuations)
        .where(and(...conditions))
        .orderBy(valuations.timestamp);
      return rows.map((r) => ({
        symbol: r.symbol, timestamp: r.timestamp,
        marketCap: r.marketCap, peTTM: r.peTTM, pb: r.pb,
        psTTM: r.psTTM, dividendYield: r.dividendYield,
        turnoverRate: r.turnoverRate, floatShares: r.floatShares,
      }));
    } catch (err) {
      throw new QueryError(`查询估值失败: ${symbol}`, err);
    }
  }
}
