import { readFileSync } from 'node:fs';
import type { DataSourceAdapter, RawDataRecord, AdapterFetchOptions } from './types.js';

/**
 * CSV 适配器 — 从 CSV 字符串或文件解析数据
 *
 * 数据来源（优先级从高到低）：
 * 1. extra.csvContent — 直接传入 CSV 内容字符串（测试友好）
 * 2. extra.filePath   — 传入文件路径，从磁盘读取（生产环境）
 * 第一行为表头，后续行为数据，自动按表头映射为键值对。
 */
export class CsvAdapter implements DataSourceAdapter {
  name = 'csv';
  supportedDomains = ['market', 'reference', 'fundamental', 'event'];
  supportedDataTypes = ['bar', 'tick', 'instrument', 'calendar', 'financial_report'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const content = this.getContent(options);
    if (!content) return;

    const lines = content.trim().split('\n');
    if (lines.length < 2) return;

    const headers = lines[0].split(',').map((h) => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      if (values.length !== headers.length) continue;
      const record: RawDataRecord = {};
      for (let j = 0; j < headers.length; j++) {
        record[headers[j]] = values[j];
      }
      yield record;
    }
  }

  private getContent(options: AdapterFetchOptions): string | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extra = options.extra as any;
    // 优先使用 csvContent（测试场景）
    if (extra?.csvContent && typeof extra.csvContent === 'string') {
      return extra.csvContent as string;
    }
    // 其次使用 filePath（生产场景）
    if (extra?.filePath && typeof extra.filePath === 'string') {
      return readFileSync(extra.filePath as string, 'utf-8');
    }
    return undefined;
  }
}
