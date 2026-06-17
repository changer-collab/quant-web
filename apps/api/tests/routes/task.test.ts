import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import type { DataCenter } from '@quant/data-center';

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

describe('Task Routes', () => {
  it('POST /api/tasks 提交回测任务返回 202', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { type: 'backtest', payload: { strategyName: 'dual-ma' } },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toHaveProperty('id');
    expect(res.json().status).toBe('pending');

    await app.close();
  });

  it('GET /api/tasks/:id 返回任务状态', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const submit = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { type: 'backtest', payload: {} },
    });
    const { id } = submit.json();

    const res = await app.inject({ method: 'GET', url: `/api/tasks/${id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(id);
    expect(res.json()).toHaveProperty('status');

    await app.close();
  });

  it('GET /api/tasks/:id 不存在返回 404', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/tasks/nonexistent' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('GET /api/tasks 列出所有任务', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    await app.inject({
      method: 'POST', url: '/api/tasks',
      payload: { type: 'backtest', payload: {} },
    });
    await app.inject({
      method: 'POST', url: '/api/tasks',
      payload: { type: 'factorCompute', payload: {} },
    });

    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);

    await app.close();
  });
});