import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import { strategySyncService } from '../../src/services/strategy-sync.js';
import type { DataCenter } from '@quant/data-center';

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

describe('Strategy Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/strategies 返回策略列表 — param camelCase + deprecated 双字段', async () => {
    const mockStrategies = [
      {
        name: 'dual_ma',
        description: '双均线策略',
        params: [
          {
            key: 'short_period',
            label: '短均线周期',
            type: 'number',
            default: 5,
            min: 2,
            max: 50,
            chart_relevant: true,
            ui_constraints: [
              { kind: 'disable_when', target_field: 'signal_type', target_value: 'macd', action_value: null },
            ],
          },
          {
            key: 'long_period',
            label: '长均线周期',
            type: 'number',
            default: 20,
            min: 5,
            max: 200,
          },
        ],
        version: '0.1.0',
        modes: ['traditional'],
        kind: 'combined',
      },
    ];

    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue(mockStrategies);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body.length).toBe(1);
    expect(body[0].name).toBe('dual_ma');
    expect(body[0].params).toBeInstanceOf(Array);

    // ── camelCase 主字段 ──
    const param = body[0].params[0];
    expect(param.name).toBe('short_period');
    expect(Array.isArray(param.range)).toBe(true);
    expect(param.range).toEqual([2, 50]);
    expect(param.chartRelevant).toBe(true);
    expect(Array.isArray(param.uiConstraints)).toBe(true);
    expect(param.uiConstraints[0].targetField).toBe('signal_type');
    expect(param.uiConstraints[0].targetValue).toBe('macd');
    expect(param.uiConstraints[0].actionValue).toBeNull();

    // ── DEPRECATED 双字段（与 name 同值） ──
    expect(param.key).toBe('short_period');
    expect(param.min).toBe(2);
    expect(param.max).toBe(50);
    expect(param.chart_relevant).toBe(true);
    expect(Array.isArray(param.ui_constraints)).toBe(true);
    expect(param.ui_constraints[0].target_field).toBe('signal_type');

    // ── range=[0,0] 当 min/max 缺省 ──
    const param2 = body[0].params[1];
    expect(param2.name).toBe('long_period');
    expect(param2.range).toEqual([5, 200]);
    expect(param2.chartRelevant).toBe(false);     // 默认 false
    expect(param2.uiConstraints).toEqual([]);      // 默认空数组
    expect(param2.key).toBe('long_period');         // deprecated 也存在

    await app.close();
  });

  it('GET /api/strategies/:name 返回策略详情 — shape 与列表项一致', async () => {
    const mockStrategies = [
      {
        name: 'dual_ma',
        description: '双均线策略',
        params: [
          {
            key: 'period',
            label: '周期',
            type: 'number',
            default: 20,
            min: 5,
            max: 200,
            chart_relevant: true,
            ui_constraints: [
              { kind: 'range_when', target_field: 'signal_type', target_value: 'sma' },
            ],
          },
        ],
        version: '0.1.0',
        modes: ['traditional'],
        kind: 'combined',
        backtestable: true,
        category: 'non_factor',
        subcategory: 'trend_cta',
      },
    ];

    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue(mockStrategies);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies/dual_ma' });
    expect(res.statusCode).toBe(200);
    const detail = res.json();
    expect(detail.name).toBe('dual_ma');
    expect(detail.modes).toBeInstanceOf(Array);

    // ── param camelCase shape 与列表端点一致 ──
    const param = detail.params[0];
    expect(param.name).toBe('period');
    expect(param.range).toEqual([5, 200]);
    expect(param.chartRelevant).toBe(true);
    expect(param.uiConstraints[0].targetField).toBe('signal_type');
    // deprecated 字段也存在
    expect(param.key).toBe('period');
    expect(param.min).toBe(5);
    expect(param.max).toBe(200);

    await app.close();
  });

  it('GET /api/strategies/:name 不存在返回 404', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies/nonexistent' });
    expect(res.statusCode).toBe(404);

    await app.close();
  });

  it('workflowReady=true 当 canonical category + canonical subcategory', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([
      {
        name: 'dual_ma',
        description: '双均线策略',
        params: [],
        version: '0.1.0',
        modes: ['traditional'],
        kind: 'combined',
        backtestable: true,
        category: 'non_factor',
        subcategory: 'trend_cta',
      },
    ]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies' });
    const body = res.json();
    expect(body[0].workflowReady).toBe(true);
    expect(body[0].category).toBe('non_factor');
    expect(body[0].subcategory).toBe('trend_cta');

    await app.close();
  });

  it('workflowReady=false 当 subcategory=null（sizer 等组件策略）', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([
      {
        name: 'equal_weight_sizer',
        description: '等权仓位器',
        params: [],
        version: '0.1.0',
        modes: ['traditional'],
        kind: 'sizer',
        backtestable: false,
        category: 'non_factor',
        subcategory: null,
      },
    ]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies' });
    expect(res.json()[0].workflowReady).toBe(false);

    await app.close();
  });

  it('GET /:name workflowReady 跟随子分类', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([
      {
        name: 'dual_ma',
        description: '双均线策略',
        params: [],
        version: '0.1.0',
        modes: ['traditional'],
        kind: 'combined',
        backtestable: true,
        category: 'non_factor',
        subcategory: 'trend_cta',
      },
    ]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies/dual_ma' });
    expect(res.json().workflowReady).toBe(true);

    await app.close();
  });

  it('未知 subcategory 值 → workflowReady=false，不抛异常', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([
      {
        name: 'bogus',
        description: '未知分类策略',
        params: [],
        version: '0.1.0',
        modes: [],
        kind: 'combined',
        backtestable: true,
        category: 'non_factor',
        subcategory: 'non_existent_subcat' as never,
      },
    ]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
    });

    const res = await app.inject({ method: 'GET', url: '/api/strategies' });
    const body = res.json();
    expect(body[0].workflowReady).toBe(false);
    expect(res.statusCode).toBe(200);

    await app.close();
  });
});
