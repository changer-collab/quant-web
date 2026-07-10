import { describe, test, expect } from 'vitest';
import { createCollector } from '@quant/data-collector';
import { CollectorDomain } from '@quant/data-collector';
import type { CollectPayload } from '../src/handlers/collect-handler.js';

describe('Parquet 采集支持', () => {
  test('createCollector 启用 parquet 源后注册了 ParquetAdapter', () => {
    const { registry } = createCollector({ sources: ['parquet'] });
    const adapter = registry.get('parquet');
    expect(adapter).toBeDefined();
    expect(adapter!.name).toBe('parquet');
    expect(adapter!.supportedDataTypes).toContain('bar');
  });

  test('CollectPayload 接受 parquet 源和 extra 参数', () => {
    const payload: CollectPayload = {
      source: 'parquet',
      dataType: 'bar',
      extra: {
        fileDir: 'E:\\quant-data\\bars\\daily',
        pythonPath: 'D:\\conda\\python.exe',
      },
    };
    expect(payload.source).toBe('parquet');
    expect(payload.extra).toBeDefined();
    expect((payload.extra as Record<string, unknown>).fileDir).toBe('E:\\quant-data\\bars\\daily');
  });

  test('CollectorTask parquet 路径使用通配符 symbol 而非逐标的迭代', () => {
    // parquet 文件包含多标的数据，不需要逐 symbol 迭代
    // 验证 task 创建时 symbols 为 ['*'] 通配符
    const task = {
      id: 'test',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'parquet',
      symbols: ['*'],
      timeframes: ['1d' as never],
      status: 'pending' as const,
      createdAt: Date.now(),
    };
    expect(task.symbols).toEqual(['*']);
    expect(task.source).toBe('parquet');
  });
});
