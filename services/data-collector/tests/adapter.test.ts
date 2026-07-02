import { describe, it, expect } from 'vitest';
import type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
} from '../src/adapters/types.js';
import { CsvAdapter } from '../src/adapters/csv-adapter.js';
import { TushareAdapter } from '../src/adapters/tushare-adapter.js';
import { AkshareAdapter } from '../src/adapters/akshare-adapter.js';

describe('适配器接口类型', () => {
  it('AdapterFetchOptions 可正确构造', () => {
    const opts: AdapterFetchOptions = {
      domain: 'market',
      dataType: 'bar',
      symbol: 'CSI500',
      timeframe: '1d',
      start: 1700000000000,
      end: 1700100000000,
    };
    expect(opts.symbol).toBe('CSI500');
  });

  it('RawDataRecord 是键值对结构', () => {
    const record: RawDataRecord = {
      symbol: 'CSI500',
      timestamp: 1700000000000,
      open: 5000,
      high: 5100,
      low: 4900,
      close: 5050,
      volume: 100000,
      turnover: 500000000,
    };
    expect(record.symbol).toBe('CSI500');
  });

  it('DataSourceAdapter 接口可被对象实现', () => {
    const adapter: DataSourceAdapter = {
      name: 'test',
      supportedDomains: ['market'],
      supportedDataTypes: ['bar'],
      fetch: async function* () {
        yield { symbol: 'CSI500', timestamp: 1 };
      },
    };
    expect(adapter.name).toBe('test');
  });
});

describe('CsvAdapter', () => {
  it('name 为 csv', () => {
    const adapter = new CsvAdapter();
    expect(adapter.name).toBe('csv');
  });

  it('支持 market 域的 bar 和 tick 类型', () => {
    const adapter = new CsvAdapter();
    expect(adapter.supportedDomains).toContain('market');
    expect(adapter.supportedDataTypes).toContain('bar');
    expect(adapter.supportedDataTypes).toContain('tick');
  });

  it('从 CSV 内容流式返回记录', async () => {
    const csvContent = `symbol,timestamp,open,high,low,close,volume,turnover
CSI500,1700000000000,5000,5100,4900,5050,100000,500000000
CSI500,1700086400000,5050,5200,5000,5150,120000,600000000`;
    const adapter = new CsvAdapter();
    const records: RawDataRecord[] = [];
    for await (const record of adapter.fetch({
      domain: 'market',
      dataType: 'bar',
      symbol: 'CSI500',
      extra: { csvContent },
    })) {
      records.push(record);
    }
    expect(records).toHaveLength(2);
    expect(records[0].symbol).toBe('CSI500');
    expect(records[0].close).toBe('5050'); // CSV 原始值都是字符串
  });

  it('空 CSV 返回空迭代', async () => {
    const csvContent = `symbol,timestamp,open,high,low,close,volume,turnover`;
    const adapter = new CsvAdapter();
    const records: RawDataRecord[] = [];
    for await (const record of adapter.fetch({
      domain: 'market',
      dataType: 'bar',
      symbol: 'CSI500',
      extra: { csvContent },
    })) {
      records.push(record);
    }
    expect(records).toHaveLength(0);
  });
});

describe('TushareAdapter', () => {
  it('name 为 tushare', () => {
    const adapter = new TushareAdapter();
    expect(adapter.name).toBe('tushare');
  });

  it('支持 market 和 reference 域', () => {
    const adapter = new TushareAdapter();
    expect(adapter.supportedDomains).toContain('market');
    expect(adapter.supportedDomains).toContain('reference');
  });

  it('支持 calendar 和 adjustment_factor 数据类型', () => {
    const adapter = new TushareAdapter();
    expect(adapter.supportedDataTypes).toContain('calendar');
    expect(adapter.supportedDataTypes).toContain('adjustment_factor');
    expect(adapter.supportedDataTypes).toContain('financial_report');
  });

  it('fetch 无 token 时抛错', async () => {
    const adapter = new TushareAdapter();
    await expect(async () => {
      for await (const _ of adapter.fetch({
        domain: 'market',
        dataType: 'bar',
        symbol: 'CSI500',
      })) {
        break;
      }
    }).rejects.toThrow('Tushare token');
  });
});

describe('AkshareAdapter', () => {
  it('name 为 akshare', () => {
    const adapter = new AkshareAdapter();
    expect(adapter.name).toBe('akshare');
  });

  it('支持 market 和 event 域', () => {
    const adapter = new AkshareAdapter();
    expect(adapter.supportedDomains).toContain('market');
    expect(adapter.supportedDomains).toContain('event');
  });

  it('支持 financial_report 数据类型', () => {
    const adapter = new AkshareAdapter();
    expect(adapter.supportedDataTypes).toContain('financial_report');
  });
});
