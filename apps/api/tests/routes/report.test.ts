import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import { initApiDb, closeApiDb } from '../../src/storage/connection.js';
import type { DataCenter } from '@quant/data-center';
import type { BacktestResult } from '../../src/types.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

function createMockDataCenter(): DataCenter {
  return {
    providers: {
      reference: {
        getTradingCalendar: async () => ({ exchange: 'SSE', year: 2024, tradingDays: [] }),
        getInstruments: async () => [],
        getIndexComposition: async () => ({ indexSymbol: 'CSI500', asOfDate: 20240101, constituents: [] }),
        getAdjustmentFactors: async () => [],
        isTradingDay: async () => true,
        getPreviousTradingDay: async () => 20240101,
      },
      market: {
        async *loadBars() {},
        async *loadTicks() {},
        getLatestBar: async () => undefined,
        getAvailableSymbols: async () => [],
        getBarsPaged: async () => ({ data: [], hasMore: false, total: 0 }),
      },
      fundamental: {
        getFinancialReports: async () => [],
        getFinancialRatios: async () => [],
        getValuationSeries: async () => [],
        getLatestReport: async () => undefined,
        getShareholderMetrics: async () => [],
      },
      event: {
        getAnnouncementEvents: async () => [],
        getNewsArticles: async () => [],
        getSentimentSeries: async () => [],
        getMacroIndicators: async () => [],
        getMacroIndicatorSeries: async () => [],
        hasAdverseEvents: async () => false,
      },
      l2: {
        async *loadSnapshots() {},
        async *loadTradeRecords() {},
        async *loadOrderRecords() {},
      },
      quality: {
        checkCompleteness: async () => ({
          source: 'test', dateRange: { start: 0, end: 0 },
          totalExpected: 0, actualCount: 0, missingDates: [],
          consistencyIssues: [], coverage: 1, isAcceptable: true,
        }),
        checkConsistency: async () => ({
          source: 'test', dateRange: { start: 0, end: 0 },
          totalExpected: 0, actualCount: 0, missingDates: [],
          consistencyIssues: [], coverage: 1, isAcceptable: true,
        }),
        checkFreshness: async () => ({
          source: 'test', dateRange: { start: 0, end: 0 },
          totalExpected: 0, actualCount: 0, missingDates: [],
          consistencyIssues: [], coverage: 1, isAcceptable: true,
        }),
      },
    },
    repos: {} as never,
    exporter: {} as never,
    close: async () => {},
    status: () => 'ready' as const,
    isClosed: () => false,
    flush: () => {},
    healthCheck: () => ({ status: 'healthy' as const, dcStatus: 'ready' as const }),
    [Symbol.asyncDispose]: async () => {},
  };
}

describe('Report Routes', () => {
  const testDbPath = resolve(process.cwd(), 'data', 'test-report-routes.db');

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    await initApiDb(testDbPath);
  });

  afterEach(() => {
    closeApiDb(false);
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('GET /api/reports 返回空列表', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/reports' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(0);

    await app.close();
  });

  it('GET /api/reports/:id 返回 404（报告不存在）', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/reports/nonexistent' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  describe('回测任务完成 -> 报告自动保存 -> 读取验证', () => {
    const mockBacktestResult: BacktestResult = {
      config: { initialCash: 1000000, slippage: 0.001, version: '1.0.0', logic: 'dual_ma', strategyKind: 'timing' },
      trades: [
        { symbol: '600519', direction: 'buy', fillPrice: 100, fillVolume: 100, commission: 5, timestamp: 1704067200000 },
        { symbol: '600519', direction: 'sell', fillPrice: 110, fillVolume: 100, commission: 5, timestamp: 1704153600000 },
      ],
      equityCurve: [
        { timestamp: 1704067200000, equity: 1000000 },
        { timestamp: 1704153600000, equity: 1010000 },
      ],
      drawdownCurve: [
        { timestamp: 1704067200000, drawdown: 0 },
        { timestamp: 1704153600000, drawdown: -0.02 },
      ],
      monthlyReturns: [
        { year: 2024, month: 1, return_pct: 0.01 },
      ],
      annualReturns: [
        { year: 2024, return_pct: 0.1 },
      ],
      metrics: {
        totalReturn: 0.1,
        annualizedReturn: 0.15,
        sharpeRatio: 1.5,
        maxDrawdown: -0.08,
        winRate: 0.6,
        totalTrades: 20,
        sortinoRatio: 1.8,
        calmarRatio: 1.5,
        annualizedVolatility: 0.12,
        maxDrawdownDuration: 45,
      },
      profitLossRatio: 2.5,
      avgHoldingDays: 12,
      maxSingleProfit: 15000,
      maxSingleLoss: -8000,
    };

    it('回测任务完成时自动保存报告，读取时 reportData 包含 drawdownCurve（非空数组）', async () => {
      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
      });

      // 提交回测任务
      const submitRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { type: 'backtest', payload: { strategy: 'dual_ma', symbol: '600519', timeframe: '1d' } },
      });
      const taskId = submitRes.json().id;

      // Worker 完成任务并提交 backtestResult
      await app.inject({
        method: 'POST',
        url: `/api/internal/tasks/${taskId}/complete`,
        payload: { result: { backtestResult: mockBacktestResult } },
      });

      // 查询报告列表
      const listRes = await app.inject({ method: 'GET', url: '/api/reports' });
      expect(listRes.statusCode).toBe(200);
      const reports = listRes.json();
      expect(reports.length).toBe(1);

      // 读取报告详情
      const detailRes = await app.inject({ method: 'GET', url: `/api/reports/${reports[0].id}` });
      expect(detailRes.statusCode).toBe(200);
      const report = detailRes.json();

      // 验证 reportData 包含 drawdownCurve（非空数组）
      expect(report.reportData.equityData.drawdownCurve).toBeDefined();
      expect(Array.isArray(report.reportData.equityData.drawdownCurve)).toBe(true);
      expect(report.reportData.equityData.drawdownCurve.length).toBeGreaterThan(0);

      await app.close();
    });

    it('回测任务完成时使用提交 payload 的起止日期保存报告区间', async () => {
      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
      });
      const startTs = new Date('2023-01-02T00:00:00').getTime();
      const endTs = new Date('2024-12-30T00:00:00').getTime();

      const submitRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: {
          type: 'backtest',
          payload: { strategy: 'dual_ma', symbol: '600519', timeframe: '1d', startTs, endTs },
        },
      });
      const taskId = submitRes.json().id;

      await app.inject({
        method: 'POST',
        url: `/api/internal/tasks/${taskId}/complete`,
        payload: { result: { backtestResult: mockBacktestResult } },
      });

      const listRes = await app.inject({ method: 'GET', url: '/api/reports' });
      const reports = listRes.json();
      expect(reports[0].startTime).toBe(startTs);
      expect(reports[0].endTime).toBe(endTs);

      const detailRes = await app.inject({ method: 'GET', url: `/api/reports/${reports[0].id}` });
      const report = detailRes.json();
      expect(report.startTime).toBe(startTs);
      expect(report.endTime).toBe(endTs);
      expect(report.reportData.overview.timeRange).toEqual({ start: '2023-01-02', end: '2024-12-30' });

      await app.close();
    });

    it('回测任务完成时自动保存报告，读取时 reportData 包含 monthlyReturns（非空数组）', async () => {
      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
      });

      const submitRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { type: 'backtest', payload: { strategy: 'dual_ma', symbol: '600519', timeframe: '1d' } },
      });
      const taskId = submitRes.json().id;

      await app.inject({
        method: 'POST',
        url: `/api/internal/tasks/${taskId}/complete`,
        payload: { result: { backtestResult: mockBacktestResult } },
      });

      const listRes = await app.inject({ method: 'GET', url: '/api/reports' });
      const detailRes = await app.inject({ method: 'GET', url: `/api/reports/${listRes.json()[0].id}` });
      const report = detailRes.json();

      // 验证 monthlyReturns（非空数组）
      expect(report.reportData.equityData.monthlyReturns).toBeDefined();
      expect(Array.isArray(report.reportData.equityData.monthlyReturns)).toBe(true);
      expect(report.reportData.equityData.monthlyReturns.length).toBeGreaterThan(0);

      // 验证 annualReturns
      expect(report.reportData.equityData.annualReturns).toBeDefined();
      expect(Array.isArray(report.reportData.equityData.annualReturns)).toBe(true);
      expect(report.reportData.equityData.annualReturns.length).toBeGreaterThan(0);

      await app.close();
    });

    it('回测任务完成时自动保存报告，读取时 reportData 包含 sortinoRatio/calmarRatio（非零值）', async () => {
      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
      });

      const submitRes = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        payload: { type: 'backtest', payload: { strategy: 'dual_ma', symbol: '600519', timeframe: '1d' } },
      });
      const taskId = submitRes.json().id;

      await app.inject({
        method: 'POST',
        url: `/api/internal/tasks/${taskId}/complete`,
        payload: { result: { backtestResult: mockBacktestResult } },
      });

      const listRes = await app.inject({ method: 'GET', url: '/api/reports' });
      const detailRes = await app.inject({ method: 'GET', url: `/api/reports/${listRes.json()[0].id}` });
      const report = detailRes.json();

      // 验证衍生统计指标在 reportData 中的非零值
      expect(report.reportData.riskAdjMetrics.sortinoRatio).toBeDefined();
      expect(report.reportData.riskAdjMetrics.sortinoRatio).toBeGreaterThan(0);
      // calmarRatio 在 riskMetrics 中（对齐前端类型）
      expect(report.reportData.riskMetrics.calmarRatio).toBeDefined();
      expect(report.reportData.riskMetrics.calmarRatio).toBeGreaterThan(0);

      // 验证 tradeStats 也有值
      expect(report.reportData.tradeStats.profitLossRatio).toBeGreaterThan(0);
      expect(report.reportData.tradeStats.avgHoldingDays).toBeGreaterThan(0);

      await app.close();
    });
  });
});