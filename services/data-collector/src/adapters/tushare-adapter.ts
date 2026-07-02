import type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
  TushareExtra,
} from './types.js';

/** Tushare Pro API 响应 */
interface TushareResponse {
  request_id: string;
  code: number;
  msg: string;
  data: {
    fields: string[];
    items: unknown[][];
  };
}

/** 重试配置 */
interface RetryConfig {
  /** 最大重试次数，默认 3 */
  maxRetries: number;
  /** 初始延迟（毫秒），默认 1000 */
  baseDelay: number;
  /** 限流间隔（毫秒），两次 API 调用之间的最小间隔，默认 500 */
  rateLimitInterval: number;
}

/**
 * Tushare 适配器 — 通过 Tushare Pro HTTP API 拉取数据
 *
 * Tushare Pro 提供 REST API，Node.js 直接 HTTP 调用，无需 Python 依赖。
 * 使用时通过 extra.token 传入 Tushare Pro token。
 *
 * 内置限流（500ms 间隔）和指数退避重试（最多 3 次），防止被 Tushare 封 IP。
 *
 * API 文档：https://tushare.pro/document/2
 */
export class TushareAdapter implements DataSourceAdapter {
  name = 'tushare';
  supportedDomains = ['market', 'reference', 'fundamental'];
  supportedDataTypes = [
    'bar',
    'tick',
    'instrument',
    'calendar',
    'adjustment_factor',
    'financial_report',
    'shareholder_metrics',
  ];

  private readonly apiUrl = 'https://api.tushare.pro';
  private readonly retryConfig: RetryConfig;
  private lastCallTime = 0;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = {
      maxRetries: retryConfig?.maxRetries ?? 3,
      baseDelay: retryConfig?.baseDelay ?? 1000,
      rateLimitInterval: retryConfig?.rateLimitInterval ?? 500,
    };
  }

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as TushareExtra | undefined;
    const token = extra?.token;
    if (!token) {
      throw new Error('Tushare token 未配置，请通过 extra.token 传入');
    }

    const { domain, dataType } = options;
    const result = this.resolveApiParams(domain, dataType, options);

    if (!result) {
      // 未实现的 domain/dataType 组合
      return;
    }

    const { apiName, params, fields } = result;
    const response = await this.callApi(token, apiName, params, fields);

    if (response.code !== 0) {
      throw new Error(`Tushare API 错误 [${apiName}]: ${response.msg}`);
    }

    const { fields: resFields, items } = response.data;
    for (const item of items) {
      const record: RawDataRecord = {};
      for (let i = 0; i < resFields.length; i++) {
        record[resFields[i]] = item[i];
      }
      yield this.normalizeRecord(record, domain, dataType, options);
    }
  }

  /** 解析 domain/dataType 到 Tushare API 参数 */
  private resolveApiParams(
    domain: string,
    dataType: string,
    options: AdapterFetchOptions
  ): { apiName: string; params: Record<string, string>; fields?: string[] } | null {
    const { symbol, timeframe, start, end } = options;
    const startDate = start ? this.formatDate(start) : '';
    const endDate = end ? this.formatDate(end) : '';

    if (domain === 'market' && dataType === 'bar') {
      const freq = this.mapTimeframe(timeframe);
      return {
        apiName: freq === '1d' ? 'daily' : 'min',
        params: {
          ts_code: this.toTsCode(symbol),
          start_date: startDate,
          end_date: endDate,
          ...(freq !== '1d' && { freq }),
        },
      };
    }

    if (domain === 'market' && dataType === 'tick') {
      return {
        apiName: 'stk_limit',
        params: {
          ts_code: this.toTsCode(symbol),
          trade_date: startDate,
        },
      };
    }

    if (domain === 'reference' && dataType === 'instrument') {
      return {
        apiName: 'stock_basic',
        params: {},
        fields: [
          'ts_code',
          'symbol',
          'name',
          'area',
          'industry',
          'market',
          'list_date',
          'list_status',
        ],
      };
    }

    if (domain === 'reference' && dataType === 'calendar') {
      return {
        apiName: 'trade_cal',
        params: {
          exchange: symbol || 'SSE',
          start_date: startDate,
          end_date: endDate,
        },
      };
    }

    if (domain === 'reference' && dataType === 'adjustment_factor') {
      return {
        apiName: 'adj_factor',
        params: {
          ts_code: this.toTsCode(symbol),
          start_date: startDate,
          end_date: endDate,
        },
      };
    }

    if (domain === 'fundamental' && dataType === 'financial_report') {
      return {
        apiName: 'fina_indicator',
        params: {
          ts_code: this.toTsCode(symbol),
          start_date: startDate,
          end_date: endDate,
        },
      };
    }

    if (domain === 'fundamental' && dataType === 'shareholder_metrics') {
      return {
        apiName: 'stk_holdernumber',
        params: {
          ts_code: this.toTsCode(symbol),
          start_date: startDate,
          end_date: endDate,
        },
      };
    }

    return null;
  }

  /** 调用 Tushare Pro API（带限流和指数退避重试） */
  private async callApi(
    token: string,
    apiName: string,
    params: Record<string, string>,
    fields?: string[]
  ): Promise<TushareResponse> {
    const body: Record<string, unknown> = {
      api_name: apiName,
      token,
      params: Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '')),
    };
    if (fields && fields.length > 0) {
      body.fields = fields.join(',');
    }

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= this.retryConfig.maxRetries; attempt++) {
      // 限流：确保两次调用之间至少间隔 rateLimitInterval
      const now = Date.now();
      const elapsed = now - this.lastCallTime;
      if (elapsed < this.retryConfig.rateLimitInterval) {
        await this.sleep(this.retryConfig.rateLimitInterval - elapsed);
      }
      this.lastCallTime = Date.now();

      try {
        const resp = await fetch(this.apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          // 429 Too Many Requests 或 5xx 可重试
          if (
            (resp.status === 429 || resp.status >= 500) &&
            attempt < this.retryConfig.maxRetries
          ) {
            const delay = this.retryConfig.baseDelay * Math.pow(2, attempt);
            await this.sleep(delay);
            continue;
          }
          throw new Error(`Tushare HTTP 错误: ${resp.status} ${resp.statusText}`);
        }

        const result = (await resp.json()) as TushareResponse;

        // Tushare 业务错误码（积分不足等）不重试
        if (result.code !== 0) {
          throw new Error(`Tushare API 错误 [${apiName}]: ${result.msg}`);
        }

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // 网络错误可重试
        if (attempt < this.retryConfig.maxRetries) {
          const delay = this.retryConfig.baseDelay * Math.pow(2, attempt);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `Tushare API 调用失败（重试 ${this.retryConfig.maxRetries} 次）: ${lastError?.message}`
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** 标准化记录字段名，对齐数据中心字段 */
  private normalizeRecord(
    record: RawDataRecord,
    domain: string,
    dataType: string,
    options: AdapterFetchOptions
  ): RawDataRecord {
    if (domain === 'market' && dataType === 'bar') {
      return {
        symbol: this.fromTsCode(String(record.ts_code ?? options.symbol)),
        timestamp: this.dateToTimestamp(String(record.trade_date ?? '')),
        open: Number(record.open) || 0,
        high: Number(record.high) || 0,
        low: Number(record.low) || 0,
        close: Number(record.close) || 0,
        volume: Number(record.vol) || 0,
        turnover: Number(record.amount) || 0,
        timeframe: options.timeframe ?? '1d',
      };
    }

    if (domain === 'reference' && dataType === 'instrument') {
      return {
        symbol: String(record.symbol ?? ''),
        name: String(record.name ?? ''),
        exchange: String(record.market ?? record.area ?? ''),
        lotSize: 100,
        priceTick: 0.01,
        industry: String(record.industry ?? ''),
        sector: String(record.area ?? ''),
        listDate: this.dateToTimestamp(String(record.list_date ?? '')),
        status: record.list_status === 'L' ? 'active' : 'delisted',
      };
    }

    if (domain === 'reference' && dataType === 'calendar') {
      return {
        exchange: String(record.exchange ?? ''),
        year: String(record.cal_date ?? '').substring(0, 4),
        tradingDays: String(record.is_open === '1' ? record.cal_date : ''),
        holidays: String(record.is_open === '0' ? record.cal_date : ''),
      };
    }

    if (domain === 'reference' && dataType === 'adjustment_factor') {
      return {
        symbol: this.fromTsCode(String(record.ts_code ?? '')),
        date: this.dateToTimestamp(String(record.trade_date ?? '')),
        factor: Number(record.adj_factor) || 1,
        type: 'forward',
      };
    }

    if (domain === 'fundamental' && dataType === 'financial_report') {
      return {
        symbol: this.fromTsCode(String(record.ts_code ?? '')),
        reportDate: this.dateToTimestamp(String(record.end_date ?? '')),
        announceDate: this.dateToTimestamp(String(record.ann_date ?? record.end_date ?? '')),
        reportType: this.inferReportType(String(record.end_date ?? '')),
        revenue: Number(record.revenue) || 0,
        costOfRevenue: Number(record.total_cogs) || 0,
        operatingIncome: Number(record.operate_profit) || 0,
        totalRevenue: Number(record.total_profit) || 0,
        netIncome: Number(record.netprofit) || 0,
        totalAssets: Number(record.total_assets) || 0,
        totalLiabilities: Number(record.total_liab) || 0,
        totalEquity: Number(record.total_hldr_eqy_exc_min_int) || 0,
        currentAssets: Number(record.total_cur_assets) || 0,
        currentLiabilities: Number(record.total_cur_liab) || 0,
        operatingCashFlow: Number(record.c_fr_sale_sg) || 0,
        investingCashFlow: Number(record.c_inv_act) || 0,
        financingCashFlow: Number(record.c_fnc_act) || 0,
        freeCashFlow: 0,
      };
    }

    if (domain === 'fundamental' && dataType === 'shareholder_metrics') {
      return {
        symbol: this.fromTsCode(String(record.ts_code ?? '')),
        announceDate: this.dateToTimestamp(String(record.ann_date ?? '')),
        endDate: this.dateToTimestamp(String(record.end_date ?? '')),
        totalHolders: Number(record.holder_number) || 0,
        avgHoldingShares: Number(record.holder_avg_stk) || 0,
        avgHoldingAmount: Number(record.holder_avg_amount) || 0,
        changeRatio: Number(record.change_ratio) || 0,
      };
    }

    return record;
  }

  /** 时间周期映射 */
  private mapTimeframe(tf?: string): string {
    const map: Record<string, string> = {
      '1m': '1min',
      '5m': '5min',
      '15m': '15min',
      '1h': '60min',
      '1d': '1d',
    };
    return map[tf ?? '1d'] ?? '1d';
  }

  /** symbol 转 ts_code（如 600519 → 600519.SH） */
  private toTsCode(symbol: string): string {
    if (symbol.includes('.')) return symbol;
    if (symbol.startsWith('6') || symbol.startsWith('9')) return `${symbol}.SH`;
    if (symbol.startsWith('0') || symbol.startsWith('3') || symbol.startsWith('2'))
      return `${symbol}.SZ`;
    return symbol;
  }

  /** ts_code 转 symbol（如 600519.SH → 600519） */
  private fromTsCode(tsCode: string): string {
    return tsCode.split('.')[0];
  }

  /** YYYYMMDD → 毫秒时间戳 */
  private dateToTimestamp(dateStr: string): number {
    if (!dateStr || dateStr.length !== 8) return 0;
    const year = parseInt(dateStr.substring(0, 4), 10);
    const month = parseInt(dateStr.substring(4, 6), 10) - 1;
    const day = parseInt(dateStr.substring(6, 8), 10);
    return Date.UTC(year, month, day);
  }

  /** 毫秒时间戳 → YYYYMMDD */
  private formatDate(ts: number): string {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  }

  /** 根据报告期推断类型 */
  private inferReportType(endDate: string): string {
    if (!endDate || endDate.length !== 8) return 'annual';
    const month = endDate.substring(4, 6);
    if (month === '03') return 'q1';
    if (month === '06') return 'q2';
    if (month === '09') return 'q3';
    return 'annual';
  }
}
