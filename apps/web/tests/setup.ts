import '@testing-library/jest-dom/vitest';
import { vi, afterEach } from 'vitest';

/**
 * Mock globalThis.fetch 防止测试中发起真实网络请求。
 *
 * 按请求方法和 URL 模式返回合理的空响应：
 * - GET /count → { count: 0 }
 * - GET 其他 → []（列表端点空数组）
 * - POST → { id, taskId, status }（满足 submitBacktest 和 submitFactorEval 解构）
 * - DELETE → { success: true }
 *
 * 个别测试可通过 mockFetch.mockImplementationOnce(...) 覆盖特定响应。
 */
export const mockFetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  let body: unknown;
  if (method === 'POST') {
    if (url.includes('/preview')) {
      body = {
        symbol: '600519',
        bars: [],
        overlays: [],
        signals: [],
        pagination: { has_more: false, next_cursor: null },
        fingerprint: 'sha256:mock-hash',
        engine_version: '1.0.0',
      };
    } else {
      body = {
        id: 'mock-task-id',
        taskId: 'mock-task-id',
        status: 'pending',
        diagnostics: { type: 'diagnostics' },
      };
    }
  } else if (method === 'PUT') {
    if (url.includes('/config')) {
      body = { saved: true, configSnapshot: { strategy: '', params: {}, hash: 'mock-hash' } };
    } else {
      body = { success: true };
    }
  } else if (method === 'DELETE') {
    body = { success: true };
  } else if (url.includes('/config')) {
    body = null;
  } else if (url.includes('/diagnostics')) {
    body = [];
  } else if (url.includes('/count')) {
    body = { count: 0 };
  } else {
    body = [];
  }

  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  );
});

vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  mockFetch.mockClear();
});
