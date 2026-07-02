import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import { initApiDb, closeApiDb } from '../../src/storage/connection.js';
import type { DataCenter } from '@quant/data-center';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

function createMockDataCenter(): DataCenter {
  return {
    providers: {
      reference: {
        getTradingCalendar: async () => ({ exchange: 'SSE', year: 2024, tradingDays: [] }),
        getInstruments: async () => [],
        getIndexComposition: async () => ({
          indexSymbol: 'CSI500',
          asOfDate: 20240101,
          constituents: [],
        }),
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
          source: 'test',
          dateRange: { start: 0, end: 0 },
          totalExpected: 0,
          actualCount: 0,
          missingDates: [],
          consistencyIssues: [],
          coverage: 1,
          isAcceptable: true,
        }),
        checkConsistency: async () => ({
          source: 'test',
          dateRange: { start: 0, end: 0 },
          totalExpected: 0,
          actualCount: 0,
          missingDates: [],
          consistencyIssues: [],
          coverage: 1,
          isAcceptable: true,
        }),
        checkFreshness: async () => ({
          source: 'test',
          dateRange: { start: 0, end: 0 },
          totalExpected: 0,
          actualCount: 0,
          missingDates: [],
          consistencyIssues: [],
          coverage: 1,
          isAcceptable: true,
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

describe('Factor Evaluation Routes', () => {
  const testDbPath = resolve(process.cwd(), 'data', 'test-eval-routes.db');

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

  it('GET /api/evaluations/factor/:factorId 返回空列表', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/evaluations/factor/factor-1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(0);

    await app.close();
  });

  it('GET /api/evaluations/:id 返回 404（评估不存在）', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/evaluations/nonexistent' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
