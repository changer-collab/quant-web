/**
 * Config Routes — 策略配置 CRUD 端点测试
 *
 * 覆盖：
 * - GET 默认值（无持久化数据 → 200 + persisted:false + default snapshot）
 * - GET 已保存配置 → 200 + persisted:true + 保存值
 * - GET 策略不存在 → 404
 * - PUT 旧 shape {config, hash} → 201 + {saved:true, configSnapshot}
 * - PUT 新 shape {category, subcategory, params, expectedHash} → 201
 * - PUT hash 冲突 → 409
 * - PUT 无效 category → 422
 * - PUT 空 body → 400
 * - PUT 策略不存在 → 404
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import { StrategyConfigService, ConfigHashConflictError } from '../../src/services/config-service.js';
import { strategySyncService } from '../../src/services/strategy-sync.js';
import type { DataCenter } from '@quant/data-center';
import type { ConfigSnapshot } from '../../src/types.js';

// ─── Helpers ──────────────────────────────────────────────────────────────

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

const MOCK_STRATEGY_META = {
  name: 'dual_ma',
  description: '双均线策略',
  params: [
    { key: 'period', label: '周期', type: 'number', default: 20, min: 2, max: 200, chart_relevant: true },
    { key: 'offset', label: '偏移', type: 'number', default: 5, min: 0, max: 50, chart_relevant: false },
  ],
  version: '0.1.0',
  modes: ['traditional'],
  kind: 'combined',
  backtestable: true,
  category: 'non_factor',
  subcategory: 'trend_cta',
};

describe('Config Routes', () => {
  let configService: StrategyConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    // 使用内存 repo 创建真实 ConfigService
    const mockRepo = { get: vi.fn(), save: vi.fn() };
    configService = new StrategyConfigService(mockRepo as any);
  });

  describe('GET /:name/config', () => {
    it('无持久化数据 → 200 + {persisted:false, configSnapshot:default}', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      vi.spyOn(configService, 'getOrDefault').mockResolvedValue({
        persisted: false,
        configSnapshot: {
          strategy: 'dual_ma',
          schemaVersion: 1,
          strategyVersion: '0.1.0',
          category: 'non_factor',
          params: {},
          hash: 'mock_default_hash',
          updatedAt: 1000,
        },
      });

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({ method: 'GET', url: '/api/strategies/dual_ma/config' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.persisted).toBe(false);
      expect(body.configSnapshot.strategy).toBe('dual_ma');
      expect(body.configSnapshot.category).toBe('non_factor');
      expect(body.configSnapshot.hash).toBe('mock_default_hash');

      await app.close();
    });

    it('有持久化数据 → 200 + {persisted:true, configSnapshot:saved}', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      vi.spyOn(configService, 'getOrDefault').mockResolvedValue({
        persisted: true,
        configSnapshot: {
          strategy: 'dual_ma',
          schemaVersion: 1,
          strategyVersion: '0.1.0',
          category: 'non_factor',
          params: { period: 20, offset: 5 },
          hash: 'saved_hash',
          updatedAt: 2000,
        },
      });

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({ method: 'GET', url: '/api/strategies/dual_ma/config' });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.persisted).toBe(true);
      expect(body.configSnapshot.params).toEqual({ period: 20, offset: 5 });
      expect(body.configSnapshot.hash).toBe('saved_hash');

      await app.close();
    });

    it('策略不存在 → 404', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([]);

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({ method: 'GET', url: '/api/strategies/nonexistent/config' });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('not found');

      await app.close();
    });

    it('传入正确的 version 和 category 到 getOrDefault', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      const spy = vi.spyOn(configService, 'getOrDefault').mockResolvedValue({
        persisted: false,
        configSnapshot: { strategy: 'dual_ma', params: {} },
      });

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      await app.inject({ method: 'GET', url: '/api/strategies/dual_ma/config' });
      expect(spy).toHaveBeenCalledWith('dual_ma', '0.1.0', 'non_factor');

      await app.close();
    });
  });

  describe('PUT /:name/config', () => {
    it('旧 shape {config, hash} → 201 + {saved:true, configSnapshot}', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      vi.spyOn(configService, 'save').mockResolvedValue({
        strategy: 'dual_ma',
        schemaVersion: 1,
        strategyVersion: '0.1.0',
        category: 'non_factor',
        params: { period: 20 },
        hash: 'old_hash_value',
        updatedAt: 1000,
      });

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/strategies/dual_ma/config',
        payload: { config: { period: 20 }, hash: 'old_hash_value' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.saved).toBe(true);
      expect(body.configSnapshot).toBeDefined();
      expect(body.configSnapshot.params).toEqual({ period: 20 });

      await app.close();
    });

    it('新 shape {category, subcategory, params, expectedHash} → 201', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      vi.spyOn(configService, 'save').mockResolvedValue({
        strategy: 'dual_ma',
        schemaVersion: 1,
        strategyVersion: '0.1.0',
        category: 'factor_based',
        subcategory: 'linear_multi_factor',
        params: { factor_pool: ['mom', 'vol'] },
        hash: 'new_hash',
        updatedAt: 1000,
      });

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/strategies/dual_ma/config',
        payload: {
          category: 'factor_based',
          subcategory: 'linear_multi_factor',
          params: { factor_pool: ['mom', 'vol'] },
          expectedHash: 'prev_hash',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(body.saved).toBe(true);
      expect(body.configSnapshot.category).toBe('factor_based');
      expect(body.configSnapshot.subcategory).toBe('linear_multi_factor');

      await app.close();
    });

    it('hash 冲突 → 409', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      vi.spyOn(configService, 'save').mockRejectedValue(
        new ConfigHashConflictError('expected_hash_v1', 'current_hash_v2', {
          strategy: 'dual_ma',
          params: { period: 20 },
        }),
      );

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/strategies/dual_ma/config',
        payload: {
          category: 'non_factor',
          params: { period: 20 },
          expectedHash: 'expected_hash_v1',
        },
      });
      expect(res.statusCode).toBe(409);
      const body = res.json();
      expect(body.error).toContain('hash conflict');
      expect(body.currentHash).toBe('current_hash_v2');

      await app.close();
    });

    it('无效 category → 422', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      vi.spyOn(configService, 'save').mockRejectedValue(
        new Error('Invalid category: "trash_cat". Must be one of: factor_based, non_factor, transitional'),
      );

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/strategies/dual_ma/config',
        payload: { category: 'trash_cat', params: {} },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error).toContain('Invalid category');

      await app.close();
    });

    it('空 body → 400', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/strategies/dual_ma/config',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain('required');

      await app.close();
    });

    it('策略不存在 → 404', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([]);

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      const res = await app.inject({
        method: 'PUT',
        url: '/api/strategies/nonexistent/config',
        payload: { config: { period: 20 }, hash: 'x' },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toContain('not found');

      await app.close();
    });

    it('旧 shape 使用 register 的 category 降级', async () => {
      vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_STRATEGY_META]);
      const spy = vi.spyOn(configService, 'save').mockResolvedValue({
        strategy: 'dual_ma',
        params: { period: 20 },
        hash: '',
        updatedAt: Date.now(),
      });

      const app = await buildApp({
        dataCenter: createMockDataCenter(),
        taskService: new InMemoryTaskService(),
        configService,
        diagnosticService: null as never,
      });

      await app.inject({
        method: 'PUT',
        url: '/api/strategies/dual_ma/config',
        payload: { config: { period: 20 }, hash: '' },
      });
      // 旧 shape 应使用 registry 的 category（non_factor）
      const calledSnapshot: ConfigSnapshot = spy.mock.calls[0][0] as ConfigSnapshot;
      expect(calledSnapshot.category).toBe('non_factor');

      await app.close();
    });
  });
});
