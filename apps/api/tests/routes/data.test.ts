import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
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
        getIndexComposition: async () => ({ indexSymbol: 'CSI500', asOfDate: 20240101, constituents: [] }),
        getAdjustmentFactors: async () => [],
        isTradingDay: async () => true,
        getPreviousTradingDay: async () => 20240101,
      },
      market: {
        async *loadBars(symbol: string) {
          if (symbol === 'CSI500') {
            yield { symbol: 'CSI500', timeframe: '1d' as any, timestamp: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000000 } as any;
          }
        },
        async *loadTicks() {},
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
        async *loadSnapshots() {},
        async *loadTradeRecords() {},
        async *loadOrderRecords() {},
      },
      quality: {
        checkCompleteness: async (source: string, symbol: string) => ({
          source, dateRange: { start: 0, end: 0 },
          totalExpected: 100, actualCount: 95, missingDates: [],
          consistencyIssues: [], coverage: 0.95, isAcceptable: true,
        }),
        checkConsistency: async (source: string, symbol: string) => ({
          source, dateRange: { start: 0, end: 0 },
          totalExpected: 100, actualCount: 100, missingDates: [],
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

describe('Data Routes', () => {
  it('GET /api/data/instruments 返回标的列表', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/data/instruments' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeInstanceOf(Array);
    expect(res.json()[0].symbol).toBe('CSI500');

    await app.close();
  });

  it('GET /api/data/bars 返回 K 线数据', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/data/bars?symbol=CSI500&timeframe=1d',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeInstanceOf(Array);

    await app.close();
  });

  it('GET /api/data/coverage 返回数据覆盖率', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/data/coverage?source=test&symbol=CSI500&start=0&end=100000',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('coverage');
    expect(res.json().coverage).toBe(0.95);

    await app.close();
  });

  it('GET /api/data/quality 返回数据质量报告', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({
      method: 'GET',
      url: '/api/data/quality?source=test&symbol=CSI500&start=0&end=100000',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('isAcceptable');

    await app.close();
  });
});