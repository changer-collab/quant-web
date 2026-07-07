/**
 * 东方财富适配器基类 — 8 个东财扩展数据适配器的公共逻辑
 *
 * 子类需实现：
 * - name：适配器名称
 * - dataType：外部记录数据类型（如 dragon_tiger）
 * - buildParams(symbol, options)：构建查询参数
 * - parseItem(item, symbol)：解析单条数据为 payload
 */
import type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
} from '../types.js';
import { emClient } from './em-client.js';

export abstract class EastMoneyBaseAdapter implements DataSourceAdapter {
  abstract name: string;
  abstract supportedDomains: string[];
  abstract supportedDataTypes: string[];

  /** 子类返回的 dataType（如 dragon_tiger / lockup / margin 等） */
  protected abstract dataType: string;

  /** 子类提供 API URL */
  protected abstract apiUrl: string;

  /** 子类构建查询参数 */
  protected abstract buildParams(
    symbol: string,
    options: AdapterFetchOptions
  ): Record<string, string | number>;

  /** 子类解析单条数据为 payload */
  protected abstract parseItem(
    item: Record<string, unknown>,
    symbol: string
  ): { payload: Record<string, unknown>; timestamp: number; recordSymbol: string };

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const { symbol } = options;
    const params = this.buildParams(symbol, options);

    try {
      const response = await emClient.get<{
        result?: { data?: Record<string, unknown>[] };
        data?: { data?: Record<string, unknown>[] };
      }>(this.apiUrl, params);

      // 兼容两种响应结构：{ result: { data: [] } } 或 { data: { data: [] } }
      const items = response?.result?.data ?? response?.data?.data ?? [];
      if (items.length === 0) return;

      for (const item of items) {
        const { payload, timestamp, recordSymbol } = this.parseItem(item, symbol);
        const id = `${this.dataType}:${recordSymbol}:${timestamp}`;
        yield {
          id,
          data_type: this.dataType,
          symbol: recordSymbol,
          timestamp,
          payload,
          source: 'eastmoney',
        };
      }
    } catch (err) {
      console.error(`东财 ${this.dataType} ${symbol} 拉取失败:`, err);
    }
  }
}
