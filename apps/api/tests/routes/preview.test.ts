/**
 * Preview Routes — chart_relevant 参数校验测试
 *
 * Phase 4a 覆盖：
 * - chart_relevant=false 的参数 → 422 + fields 列表
 * - chart_relevant=true 的参数 → 通过校验，正常计算
 * - 空 preview_params → 跳过校验
 * - 不存在的策略 → 404
 * - 多个非 chart 字段 → 422 列出全部违规字段
 *
 * 注意：正常路径（chart_relevant=true）需要 mock barRepo 提供空 K 线，
 * PreviewService.computePreview([]) 返回空结果但不崩溃。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import { StrategyConfigService } from '../../src/services/config-service.js';
import { PreviewService } from '../../src/services/preview-service.js';
import { strategySyncService } from '../../src/services/strategy-sync.js';
import type { ConfigSnapshot } from '../../src/types.js';
import type { DataCenter } from '@quant/data-center';

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * 创建含空 barRepo 的 mock DataCenter
 * 正常路径（chart_relevant=true）需要 barRepo.queryPaged 返回空数据，
 * PreviewService.computePreview([]) 返回空结果但不崩溃。
 */
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
    repos: {
      bars: {
        query: async () => [],
        queryPaged: async () => ({ data: [], hasMore: false, total: 0 }),
      },
    } as never,
    exporter: {} as never,
    close: async () => {},
    status: () => 'ready' as const,
    isClosed: () => false,
    flush: () => {},
    healthCheck: () => ({ status: 'healthy' as const, dcStatus: 'ready' as const }),
    [Symbol.asyncDispose]: async () => {},
  };
}

/** 模拟策略 — dual_ma，含 chart_relevant=true 的 period 和 chart_relevant=false 的 offset */
const MOCK_DUAL_MA_META = {
  name: 'dual_ma',
  description: '双均线策略',
  params: [
    {
      key: 'period',
      label: '周期',
      type: 'number',
      default: 20,
      min: 2,
      max: 200,
      chart_relevant: true,
    },
    {
      key: 'offset',
      label: '偏移',
      type: 'number',
      default: 5,
      min: 0,
      max: 50,
      chart_relevant: false,
    },
  ],
  version: '0.1.0',
  modes: ['traditional'],
  kind: 'combined',
  backtestable: true,
  category: 'non_factor',
  subcategory: 'trend_cta',
};

/** 另一个模拟策略 — 全 chart_relevant 参数 */
const MOCK_MACD_META = {
  name: 'macd_strategy',
  description: 'MACD 策略',
  params: [
    {
      key: 'fast_period',
      label: '快线周期',
      type: 'number',
      default: 12,
      min: 2,
      max: 100,
      chart_relevant: true,
    },
    {
      key: 'slow_period',
      label: '慢线周期',
      type: 'number',
      default: 26,
      min: 5,
      max: 200,
      chart_relevant: true,
    },
    {
      key: 'signal_period',
      label: '信号周期',
      type: 'number',
      default: 9,
      min: 2,
      max: 50,
      chart_relevant: true,
    },
  ],
  version: '1.0.0',
  modes: ['traditional'],
  kind: 'combined',
  backtestable: true,
  category: 'non_factor',
  subcategory: 'trend_cta',
};

describe('Preview Routes — chart_relevant validation', () => {
  let configService: StrategyConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    configService = new StrategyConfigService({ get: vi.fn(), save: vi.fn() } as any);
  });

  it('chart_relevant=false 的 param → 422 + fields 列出违规字段', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService,
      diagnosticService: null as never,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/dual_ma/preview',
      payload: { symbol: '000300.SH', timeframe: '1d', preview_params: { offset: 5 } },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.error).toContain('non-chart-relevant');
    expect(body.fields).toEqual(['offset']);

    await app.close();
  });

  it('chart_relevant=true 的 param → 通过校验，正常计算', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService,
      diagnosticService: null as never,
    });

    // period 是 chart_relevant=true，应通过校验
    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/dual_ma/preview',
      payload: { symbol: '000300.SH', timeframe: '1d', preview_params: { period: 20 } },
    });
    // 通过校验，进入正常计算路径（没有 bars，返回 200 + 空结果）
    expect(res.statusCode).toBe(200);

    await app.close();
  });

  it('空 preview_params → 跳过校验，正常返回 preview', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService,
      diagnosticService: null as never,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/dual_ma/preview',
      payload: { symbol: '000300.SH', timeframe: '1d' },
    });
    expect(res.statusCode).toBe(200);
    // 正常预览响应应有 bars 等字段
    const body = res.json();
    expect(body).toHaveProperty('bars');
    expect(body).toHaveProperty('overlays');
    expect(body).toHaveProperty('signals');

    await app.close();
  });

  it('不存在的策略 → 404（不做校验，route 早返回）', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService,
      diagnosticService: null as never,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/nonexistent/preview',
      payload: { symbol: '000300.SH', timeframe: '1d', preview_params: { period: 20 } },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('not found');

    await app.close();
  });

  it('多个非 chart 字段 → 422 列出全部违规字段', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService,
      diagnosticService: null as never,
    });

    // 传入多个非 chart_relevant 字段（含注册表中定义的 + 未定义的）
    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/dual_ma/preview',
      payload: {
        symbol: '000300.SH',
        timeframe: '1d',
        preview_params: { offset: 5, unknown_param: 'x' },
      },
    });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.fields).toContain('offset');
    expect(body.fields).toContain('unknown_param');
    expect(body.fields.length).toBe(2);

    await app.close();
  });

  it('全 chart_relevant 参数策略 → 全部通过校验', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_MACD_META]);

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService,
      diagnosticService: null as never,
    });

    // macd_strategy 的所有 params 都是 chart_relevant=true
    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/macd_strategy/preview',
      payload: {
        symbol: '000300.SH',
        timeframe: '1d',
        preview_params: { fast_period: 12, slow_period: 26, signal_period: 9 },
      },
    });
    expect(res.statusCode).toBe(200);

    await app.close();
  });

  // ─── Phase 4b: Preview config 合并 ─────────────────────────────────

  it('Phase 4b: 已保存 config 与 preview_params 合并（preview_params 优先）', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    // 模拟已保存的配置
    const savedConfig: ConfigSnapshot = {
      strategy: 'dual_ma',
      schemaVersion: 1,
      params: { period: 20, offset: 5 },
      hash: 'sha256:abc123',
      updatedAt: Date.now(),
    };
    const mockRepo = {
      get: vi.fn().mockResolvedValue(savedConfig),
      save: vi.fn(),
    };
    const mergeConfigService = new StrategyConfigService(mockRepo as any);

    const computePreviewSpy = vi.spyOn(PreviewService, 'computePreview');

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService: mergeConfigService,
      diagnosticService: null as never,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/dual_ma/preview',
      payload: { symbol: '000300.SH', timeframe: '1d', preview_params: { period: 10 } },
    });
    expect(res.statusCode).toBe(200);
    // 合并结果: baseline {period:20,offset:5} + preview_params {period:10} → {period:10,offset:5}
    expect(computePreviewSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ period: 10, offset: 5 })
    );

    computePreviewSpy.mockRestore();
    await app.close();
  });

  it('Phase 4b: 无保存 config（仅默认值）→ preview_params 全量生效', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    // 模拟无保存配置（repo.get → null，buildDefaultSnapshot 产生 params:{}）
    const mockRepo = {
      get: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    };
    const emptyConfigService = new StrategyConfigService(mockRepo as any);

    const computePreviewSpy = vi.spyOn(PreviewService, 'computePreview');

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService: emptyConfigService,
      diagnosticService: null as never,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/dual_ma/preview',
      payload: { symbol: '000300.SH', timeframe: '1d', preview_params: { period: 20 } },
    });
    expect(res.statusCode).toBe(200);
    // 无保存 config → baseline params={} → 只有 preview_params 生效
    expect(computePreviewSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ period: 20 })
    );

    computePreviewSpy.mockRestore();
    await app.close();
  });

  it('Phase 4b: 空 preview_params → 使用已保存 config 的 baseline 参数', async () => {
    vi.spyOn(strategySyncService, 'syncFromPython').mockResolvedValue([MOCK_DUAL_MA_META]);

    // 模拟已保存的配置
    const savedConfig: ConfigSnapshot = {
      strategy: 'dual_ma',
      schemaVersion: 1,
      params: { period: 20, offset: 5 },
      hash: 'sha256:abc123',
      updatedAt: Date.now(),
    };
    const mockRepo = {
      get: vi.fn().mockResolvedValue(savedConfig),
      save: vi.fn(),
    };
    const mergeConfigService = new StrategyConfigService(mockRepo as any);

    const computePreviewSpy = vi.spyOn(PreviewService, 'computePreview');

    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      configService: mergeConfigService,
      diagnosticService: null as never,
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/strategies/dual_ma/preview',
      payload: { symbol: '000300.SH', timeframe: '1d', preview_params: {} },
    });
    expect(res.statusCode).toBe(200);
    // 空 preview_params → 使用 baseline {period:20,offset:5}
    expect(computePreviewSpy).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ period: 20, offset: 5 })
    );

    computePreviewSpy.mockRestore();
    await app.close();
  });
});
