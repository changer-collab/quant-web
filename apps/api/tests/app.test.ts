import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app.js';
import { InMemoryTaskService } from '../src/plugins/task-service.js';
import type { DataCenter } from '@quant/data-center';

function createMockDataCenter(): DataCenter {
  return {
    providers: {
      reference: {
        getTradingCalendar: async () => ({ exchange: 'SSE', year: 2024, tradingDays: [] }),
        getInstruments: async (query?: any) => {
          if (query?.symbol) return [{ symbol: 'CSI500', name: '中证500', exchange: 'SSE' }];
          return [{ symbol: 'CSI500', name: '中证500', exchange: 'SSE' }];
        },
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
        async *loadBars() {
          /* no bars */
        },
        async *loadTicks() {
          /* no ticks */
        },
        getLatestBar: async () => undefined,
        getAvailableSymbols: async () => ['CSI500'],
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
        async *loadSnapshots() {
          /* no snapshots */
        },
        async *loadTradeRecords() {
          /* no trades */
        },
        async *loadOrderRecords() {
          /* no orders */
        },
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

describe('App', () => {
  it('启动并注册所有路由', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies' });
    expect(res.statusCode).toBe(200);

    await app.close();
  });

  it('插件注册后可通过 app 访问', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    expect(app.dataCenter).toBeDefined();
    expect(app.taskService).toBeDefined();

    await app.close();
  });
});
