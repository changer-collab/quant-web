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

const TEST_FACTOR = {
  id: 'ma5',
  name: 'MA5',
  formula: 'ma(close,5)',
  category: 'technical',
  modes: ['traditional'],
  frequency: '1d',
  status: 'active',
  version: '1.0.0',
};

describe('Factor Routes', () => {
  it('POST /api/factors 创建因子定义返回 201', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/factors',
      payload: TEST_FACTOR,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe('ma5');

    await app.close();
  });

  it('GET /api/factors 返回因子列表', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    await app.inject({ method: 'POST', url: '/api/factors', payload: TEST_FACTOR });

    const res = await app.inject({ method: 'GET', url: '/api/factors' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
    expect(res.json()[0].id).toBe('ma5');

    await app.close();
  });

  it('GET /api/factors/:id 返回因子详情', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    await app.inject({ method: 'POST', url: '/api/factors', payload: TEST_FACTOR });

    const res = await app.inject({ method: 'GET', url: '/api/factors/ma5' });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('MA5');

    await app.close();
  });

  it('GET /api/factors/:id 不存在返回 404', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/factors/nonexistent' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('PUT /api/factors/:id 更新因子定义', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    await app.inject({ method: 'POST', url: '/api/factors', payload: TEST_FACTOR });

    const res = await app.inject({
      method: 'PUT',
      url: '/api/factors/ma5',
      payload: { name: 'MA5-Updated' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('MA5-Updated');

    await app.close();
  });

  it('DELETE /api/factors/:id 删除因子定义', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    await app.inject({ method: 'POST', url: '/api/factors', payload: TEST_FACTOR });

    const del = await app.inject({ method: 'DELETE', url: '/api/factors/ma5' });
    expect(del.statusCode).toBe(204);

    const get = await app.inject({ method: 'GET', url: '/api/factors/ma5' });
    expect(get.statusCode).toBe(404);

    await app.close();
  });

  it('POST /api/factors/:id/evaluate 触发评估返回 202', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    await app.inject({ method: 'POST', url: '/api/factors', payload: TEST_FACTOR });

    const res = await app.inject({
      method: 'POST',
      url: '/api/factors/ma5/evaluate',
      payload: { symbol: 'CSI500' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toHaveProperty('taskId');

    await app.close();
  });

  it('POST /api/factors/compute 触发批量计算返回 202', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/factors/compute',
      payload: { factorIds: ['ma5', 'ma10'], symbol: 'CSI500', timeframe: '1d' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json()).toHaveProperty('taskId');

    await app.close();
  });
});