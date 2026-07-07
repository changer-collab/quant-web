/**
 * 东方财富统一 HTTP 客户端 — 单例 + 串行队列 + 限流 + 重试
 *
 * 东财对 IP 敏感，裸 fetch 会被 403/429。本客户端封装：
 * 1. 串行队列：所有请求排队执行，避免并发触发风控
 * 2. 限流：请求间隔 ≥1s + 0-500ms 随机抖动
 * 3. 重试：429/5xx 指数退避（3 次），403 不重试直接抛
 * 4. 会话复用：缓存首页 cookie，避免每次请求都拿 cookie
 *
 * 参考：https://github.com/simonlin1212/a-stock-data 的 em_get() 模式
 */

const DEFAULT_MIN_INTERVAL = 1000; // 最小请求间隔 1s
const DEFAULT_JITTER = 500; // 0-500ms 随机抖动
const DEFAULT_MAX_RETRY = 3; // 429/5xx 最多重试 3 次
const DEFAULT_TIMEOUT = 15_000; // 单次请求超时 15s
const DEFAULT_SESSION_TTL = 30 * 60 * 1000; // 会话 cookie 缓存 30 分钟
const EM_HOME_URL = 'https://quote.eastmoney.com/';

interface EMSession {
  cookie: string;
  expiresAt: number;
}

interface EMClientOptions {
  minInterval?: number;
  jitter?: number;
  maxRetry?: number;
  timeout?: number;
  sessionTtl?: number;
}

export class EMClient {
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private session: EMSession | null = null;
  private readonly minInterval: number;
  private readonly jitter: number;
  private readonly maxRetry: number;
  private readonly timeout: number;
  private readonly sessionTtl: number;

  constructor(options: EMClientOptions = {}) {
    this.minInterval = options.minInterval ?? DEFAULT_MIN_INTERVAL;
    this.jitter = options.jitter ?? DEFAULT_JITTER;
    this.maxRetry = options.maxRetry ?? DEFAULT_MAX_RETRY;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.sessionTtl = options.sessionTtl ?? DEFAULT_SESSION_TTL;
  }

  /**
   * GET 请求 — 自动串行排队 + 限流 + 重试
   * 所有东财适配器共用此方法，确保全局串行
   */
  async get<T = unknown>(
    url: string,
    params?: Record<string, string | number>,
    headers?: Record<string, string>
  ): Promise<T> {
    const fullUrl = this.buildUrl(url, params);
    return this.enqueue(() => this.doGetWithRetry<T>(fullUrl, headers));
  }

  /**
   * POST 请求 — 语义同 get，用于东财需要 POST 的接口
   */
  async post<T = unknown>(
    url: string,
    body?: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.enqueue(() => this.doPostWithRetry<T>(url, body, headers));
  }

  /** 串行排队：所有请求依次执行 */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** GET + 重试逻辑 */
  private async doGetWithRetry<T>(
    url: string,
    headers?: Record<string, string>
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetry; attempt++) {
      if (attempt > 0) {
        await this.exponentialBackoff(attempt);
      }
      await this.waitInterval();

      const cookie = await this.ensureSession();
      const response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://quote.eastmoney.com/',
          Cookie: cookie,
          ...headers,
        },
      });

      if (response.status === 403) {
        this.invalidateSession();
        throw new Error(`EMClient 403 Forbidden (url=${url}) — 不重试`);
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(
          `EMClient ${response.status} (url=${url}, attempt=${attempt + 1})`
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `EMClient ${response.status} (url=${url}) — 非重试状态码`
        );
      }

      const text = await response.text();
      return this.parseResponse<T>(text);
    }
    throw lastError ?? new Error(`EMClient 重试 ${this.maxRetry} 次后仍失败`);
  }

  /** POST + 重试逻辑 */
  private async doPostWithRetry<T>(
    url: string,
    body?: Record<string, unknown>,
    headers?: Record<string, string>
  ): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.maxRetry; attempt++) {
      if (attempt > 0) {
        await this.exponentialBackoff(attempt);
      }
      await this.waitInterval();

      const cookie = await this.ensureSession();
      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: 'https://quote.eastmoney.com/',
          Cookie: cookie,
          'Content-Type': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (response.status === 403) {
        this.invalidateSession();
        throw new Error(`EMClient POST 403 Forbidden (url=${url}) — 不重试`);
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(
          `EMClient POST ${response.status} (url=${url}, attempt=${attempt + 1})`
        );
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `EMClient POST ${response.status} (url=${url}) — 非重试状态码`
        );
      }

      const text = await response.text();
      return this.parseResponse<T>(text);
    }
    throw lastError ?? new Error(`EMClient POST 重试 ${this.maxRetry} 次后仍失败`);
  }

  /** 限流：确保两次请求间隔 ≥ minInterval + jitter */
  private async waitInterval(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const need = this.minInterval + Math.random() * this.jitter;
    if (elapsed < need) {
      await this.sleep(need - elapsed);
    }
    this.lastRequestAt = Date.now();
  }

  /** 指数退避：base=1s, 2^attempt 倍数 */
  private async exponentialBackoff(attempt: number): Promise<void> {
    const delay = 1000 * Math.pow(2, attempt);
    await this.sleep(delay);
  }

  /** 会话复用：cookie 未过期直接返回，否则重新拿 */
  private async ensureSession(): Promise<string> {
    if (this.session && Date.now() < this.session.expiresAt) {
      return this.session.cookie;
    }
    try {
      const response = await this.fetchWithTimeout(EM_HOME_URL, {
        method: 'GET',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      const setCookie = response.headers.get('set-cookie') ?? '';
      const cookie = setCookie.split(';')[0] || '';
      this.session = {
        cookie,
        expiresAt: Date.now() + this.sessionTtl,
      };
      return cookie;
    } catch {
      return '';
    }
  }

  /** 失效会话缓存 */
  private invalidateSession(): void {
    this.session = null;
  }

  /** fetch + 超时控制 */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /** 拼接 URL + query params */
  private buildUrl(
    base: string,
    params?: Record<string, string | number>
  ): string {
    if (!params || Object.keys(params).length === 0) return base;
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      search.set(k, String(v));
    }
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${search.toString()}`;
  }

  /** 解析响应：尝试 JSON，失败返回原始文本 */
  private parseResponse<T>(text: string): T {
    const trimmed = text.trim();
    if (!trimmed) return '' as T;
    try {
      return JSON.parse(trimmed) as T;
    } catch {
      return trimmed as unknown as T;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/** 模块级单例 — 所有东财适配器共用 */
export const emClient = new EMClient();
