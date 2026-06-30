import { describe, it, expect } from 'vitest';
import { buildApp } from '../../src/app.js';
import { InMemoryTaskService } from '../../src/plugins/task-service.js';
import type { DataCenter } from '@quant/data-center';
import { TaskType } from '../../src/types.js';
import type { ResultProcessor } from '../../src/services/result-processors/types.js';

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

/** Mock diagnostics processor — 模拟 store + 产出信封 */
const mockDiagnosticsProcessor: ResultProcessor = {
  async process(ctx) {
    const payload = ctx.task.payload as Record<string, unknown>;
    const diagData = (ctx.result as { diagnostics?: Record<string, unknown> }).diagnostics ?? ctx.result;
    const resultId = `diag-${ctx.task.id}-${Date.now()}`;
    return {
      resultId,
      resultType: 'diagnostics',
      data: { category: payload.category ?? 'non_factor', diagnostics: diagData },
    };
  },
};

function createMockProcessorRegistry(): Map<TaskType, ResultProcessor> {
  const map = new Map<TaskType, ResultProcessor>();
  map.set(TaskType.Diagnostics, mockDiagnosticsProcessor);
  return map;
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

  it('POST /internal/:id/complete diagnostics 后 SSE 事件顶层含 resultType 与 resultId', async () => {
    const app = await buildApp({
      dataCenter: createMockDataCenter(),
      taskService: new InMemoryTaskService(),
      resultProcessorRegistry: createMockProcessorRegistry(),
    });

    // 创建 diagnostics 任务
    const submit = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { type: 'diagnostics', payload: { strategy: 'test-strategy', category: 'factor_based' } },
    });
    expect(submit.statusCode).toBe(202);
    const { id } = submit.json();

    // 收集 SSE 事件
    const events: unknown[] = [];
    app.taskService.subscribe(id, (event) => events.push(event));

    // 认领任务
    const claim = await app.inject({
      method: 'POST',
      url: `/api/internal/tasks/${id}/claim`,
    });
    expect(claim.statusCode).toBe(200);

    // 完成任务带诊断数据
    const complete = await app.inject({
      method: 'POST',
      url: `/api/internal/tasks/${id}/complete`,
      payload: {
        result: {
          diagnostics: { type: 'factor_based', ic_series: [{ period: '2024-01', ic: 0.05, rank_ic: 0.04 }] },
        },
      },
    });
    expect(complete.statusCode).toBe(200);

    // 找到 result 事件，验证顶层字段
    const resultEvents = (events as Array<{ type: string; resultId?: string; resultType?: string }>)
      .filter((e) => e.type === 'result');
    expect(resultEvents.length).toBeGreaterThanOrEqual(1);
    const result = resultEvents[resultEvents.length - 1];
    expect(result.resultType).toBe('diagnostics');
    expect(result.resultId).toBeDefined();
    expect(typeof result.resultId).toBe('string');

    // data 内仍保留 resultId/resultType（向下兼容旧前端）
    expect(result.data).toBeDefined();
    const data = result.data as Record<string, unknown>;
    expect(data.resultId).toBe(result.resultId);
    expect(data.resultType).toBe('diagnostics');

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