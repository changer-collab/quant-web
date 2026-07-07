import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EMClient } from '../src/adapters/eastmoney/em-client.js';

describe('EMClient', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  /** 创建测试用客户端，sessionTtl 设大让 session 只获取一次 */
  function createTestClient(options: {
    minInterval?: number;
    maxRetry?: number;
  } = {}): EMClient {
    return new EMClient({
      minInterval: options.minInterval ?? 10,
      jitter: 0,
      maxRetry: options.maxRetry ?? 3,
      timeout: 5000,
      sessionTtl: 30 * 60 * 1000,
    });
  }

  it('限流：连续两次请求间隔 ≥ minInterval', async () => {
    const minInterval = 200;
    const dataFetchTimestamps: number[] = [];
    const sessionFetched = { done: false };

    const mockFetch = vi.fn(async (url: string) => {
      const isSession = !sessionFetched.done && url.includes('eastmoney.com') && !url.includes('api');
      if (isSession) {
        sessionFetched.done = true;
        return new Response('<html></html>', {
          status: 200,
          headers: { 'set-cookie': 'sid=test; Path=/' },
        });
      }
      dataFetchTimestamps.push(Date.now());
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'set-cookie': 'sid=test; Path=/' },
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createTestClient({ minInterval });

    await client.get('https://example.com/api1');
    await client.get('https://example.com/api2');

    expect(dataFetchTimestamps.length).toBe(2);
    const gap = dataFetchTimestamps[1] - dataFetchTimestamps[0];
    expect(gap).toBeGreaterThanOrEqual(minInterval - 30);
  }, 10000);

  it('429 重试：最多重试 maxRetry 次后成功', async () => {
    let dataCallCount = 0;
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('eastmoney.com') && !url.includes('api')) {
        return new Response('<html></html>', {
          status: 200,
          headers: { 'set-cookie': 'sid=test; Path=/' },
        });
      }
      dataCallCount++;
      if (dataCallCount <= 3) {
        return new Response('rate limited', { status: 429 });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {},
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createTestClient({ maxRetry: 3 });
    const result = await client.get('https://example.com/api');
    expect(result).toEqual({ ok: true });
    expect(dataCallCount).toBe(4);
  }, 15000);

  it('429 全部重试失败后抛错', async () => {
    let dataCallCount = 0;
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('eastmoney.com') && !url.includes('api')) {
        return new Response('<html></html>', {
          status: 200,
          headers: { 'set-cookie': 'sid=test; Path=/' },
        });
      }
      dataCallCount++;
      return new Response('rate limited', { status: 429 });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createTestClient({ maxRetry: 2 });
    await expect(client.get('https://example.com/api')).rejects.toThrow(
      /429/
    );
    expect(dataCallCount).toBe(3);
  }, 15000);

  it('403 不重试：直接抛错', async () => {
    let dataCallCount = 0;
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('eastmoney.com') && !url.includes('api')) {
        return new Response('<html></html>', {
          status: 200,
          headers: { 'set-cookie': 'sid=test; Path=/' },
        });
      }
      dataCallCount++;
      return new Response('forbidden', { status: 403 });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createTestClient({ maxRetry: 3 });
    await expect(client.get('https://example.com/api')).rejects.toThrow(
      /403/
    );
    expect(dataCallCount).toBe(1);
  });

  it('5xx 重试：500 状态码触发重试', async () => {
    let dataCallCount = 0;
    const mockFetch = vi.fn(async (url: string) => {
      if (url.includes('eastmoney.com') && !url.includes('api')) {
        return new Response('<html></html>', {
          status: 200,
          headers: { 'set-cookie': 'sid=test; Path=/' },
        });
      }
      dataCallCount++;
      if (dataCallCount < 3) {
        return new Response('server error', { status: 500 });
      }
      return new Response(JSON.stringify({ data: 'ok' }), {
        status: 200,
        headers: {},
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createTestClient({ maxRetry: 3 });
    const result = await client.get('https://example.com/api');
    expect(result).toEqual({ data: 'ok' });
    expect(dataCallCount).toBe(3);
  }, 15000);

  it('串行队列：多个请求依次执行不并发', async () => {
    const executionOrder: string[] = [];
    const sessionFetched = { done: false };

    const mockFetch = vi.fn(async (url: string) => {
      const isSession = !sessionFetched.done && url.includes('eastmoney.com') && !url.includes('api');
      if (isSession) {
        sessionFetched.done = true;
        executionOrder.push(`start:${url}`);
        executionOrder.push(`end:${url}`);
        return new Response('<html></html>', {
          status: 200,
          headers: { 'set-cookie': 'sid=test; Path=/' },
        });
      }
      executionOrder.push(`start:${url}`);
      await new Promise((r) => setTimeout(r, 20));
      executionOrder.push(`end:${url}`);
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: {},
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createTestClient({ minInterval: 10 });

    const p1 = client.get('https://example.com/1');
    const p2 = client.get('https://example.com/2');
    const p3 = client.get('https://example.com/3');
    await Promise.all([p1, p2, p3]);

    const dataEvents = executionOrder.filter(
      (e) => !e.includes('eastmoney.com/')
    );
    expect(dataEvents).toEqual([
      'start:https://example.com/1',
      'end:https://example.com/1',
      'start:https://example.com/2',
      'end:https://example.com/2',
      'start:https://example.com/3',
      'end:https://example.com/3',
    ]);
  }, 10000);

  it('URL 拼接：params 正确附加到 query string', async () => {
    const capturedUrls: string[] = [];
    const mockFetch = vi.fn(async (url: string) => {
      capturedUrls.push(url);
      if (url.includes('eastmoney.com') && !url.includes('api')) {
        return new Response('<html></html>', {
          status: 200,
          headers: { 'set-cookie': 'sid=test; Path=/' },
        });
      }
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: {},
      });
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = createTestClient();
    await client.get('https://example.com/api', {
      page: 1,
      size: 20,
      type: 'daily',
    });

    const dataUrl = capturedUrls.find((u) => u.includes('api'));
    expect(dataUrl).toBeDefined();
    expect(dataUrl!).toContain('page=1');
    expect(dataUrl!).toContain('size=20');
    expect(dataUrl!).toContain('type=daily');
  });
});
