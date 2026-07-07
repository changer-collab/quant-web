import { describe, it, expect } from 'vitest';
import { ParquetAdapter } from '../src/adapters/parquet-adapter.js';

describe('ParquetAdapter', () => {
  it('name 为 parquet', () => {
    const adapter = new ParquetAdapter();
    expect(adapter.name).toBe('parquet');
  });

  it('支持 market 域', () => {
    const adapter = new ParquetAdapter();
    expect(adapter.supportedDomains).toContain('market');
  });

  it('支持 bar 数据类型', () => {
    const adapter = new ParquetAdapter();
    expect(adapter.supportedDataTypes).toContain('bar');
    expect(adapter.supportedDataTypes).toContain('tick');
    expect(adapter.supportedDataTypes).toContain('trade_record');
  });

  it('无 filePath/fileDir 时抛错', async () => {
    const adapter = new ParquetAdapter();
    await expect(async () => {
      for await (const _ of adapter.fetch({
        domain: 'market',
        dataType: 'bar',
        symbol: '000001.SZ',
      })) {
        break;
      }
    }).rejects.toThrow('filePath');
  });
});
