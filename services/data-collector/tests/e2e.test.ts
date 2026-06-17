/**
 * 端到端集成测试 — 从 CSV 采集到数据中心写入的完整流程
 *
 * 使用内存 mock 替代真实 SQLite，避免 sql.js WASM 路径问题。
 * 真实 SQLite 集成由 data-center 自身的测试覆盖。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { RepositorySet, Watermark } from '@quant/data-center';
import { TimeFrame } from '@quant/data-center';
import { AdapterRegistryImpl, CsvAdapter, CollectorScheduler, CollectorDomain } from '../src/index.js';
import type { CollectorTask } from '../src/types.js';

/** 内存版 WatermarkRepository */
class InMemoryWatermarkRepo {
  private data = new Map<string, Watermark>();
  private key(s: string, d: string, sym: string) { return `${s}:${d}:${sym}`; }
  async get(source: string, dataType: string, symbol: string) { return this.data.get(this.key(source, dataType, symbol)); }
  async upsert(wm: Watermark) { this.data.set(this.key(wm.source, wm.dataType, wm.symbol), wm); }
  async list(source: string, dataType?: string) {
    return [...this.data.values()].filter(w => w.source === source && (!dataType || w.dataType === dataType));
  }
}

/** 内存版 BarRepository */
class InMemoryBarRepo {
  private bars: any[] = [];
  async save(bars: any[]) { this.bars.push(...bars); }
  async query(filter: any) {
    return this.bars.filter(b => {
      if (filter.symbol && b.symbol !== filter.symbol) return false;
      if (filter.timeframe && b.timeframe !== filter.timeframe) return false;
      return true;
    });
  }
}

/** 内存版 InstrumentRepository */
class InMemoryInstrumentRepo {
  private instruments: any[] = [];
  async save(insts: any[]) { this.instruments.push(...insts); }
  async query(filter: any) {
    return this.instruments.filter(i => {
      if (filter.symbol && i.symbol !== filter.symbol) return false;
      return true;
    });
  }
}

function createMockRepos(): RepositorySet {
  return {
    watermarks: new InMemoryWatermarkRepo() as any,
    bars: new InMemoryBarRepo() as any,
    instruments: new InMemoryInstrumentRepo() as any,
  } as unknown as RepositorySet;
}

describe('端到端集成测试', () => {
  let repos: RepositorySet;
  let barRepo: InMemoryBarRepo;
  let instrumentRepo: InMemoryInstrumentRepo;

  beforeEach(() => {
    barRepo = new InMemoryBarRepo();
    instrumentRepo = new InMemoryInstrumentRepo();
    repos = {
      watermarks: new InMemoryWatermarkRepo(),
      bars: barRepo,
      instruments: instrumentRepo,
    } as unknown as RepositorySet;
  });

  it('CSV → 清洗 → 写入 data-center → 水位更新', async () => {
    const registry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    const scheduler = new CollectorScheduler(registry, repos);

    const csvContent = `symbol,timestamp,open,high,low,close,volume,turnover
CSI500,1700000000000,5000,5100,4900,5050,100000,500000000
CSI500,1700086400000,5050,5200,5000,5150,120000,600000000
CSI500,1700172800000,5150,5300,5100,5250,150000,750000000`;

    const task: CollectorTask = {
      id: 'e2e-bar',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'csv',
      symbols: ['CSI500'],
      timeframes: [TimeFrame.D1],
      status: 'pending',
      createdAt: Date.now(),
    };

    const results = await scheduler.execute(task, { csvContent });
    expect(results).toHaveLength(1);
    expect(results[0].recordsWritten).toBe(3);
    expect(results[0].lastTimestamp).toBe(1700172800000);

    // 验证数据已写入
    const bars = await barRepo.query({ symbol: 'CSI500', timeframe: TimeFrame.D1 });
    expect(bars.length).toBe(3);
    expect(bars[0].close).toBe(5050);

    // 验证水位已更新
    const wm = await repos.watermarks.get('csv', 'bar', 'CSI500');
    expect(wm).toBeDefined();
    expect(wm!.lastTimestamp).toBe(1700172800000);
  });

  it('增量采集：水位之后只拉取新数据', async () => {
    const registry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    const scheduler = new CollectorScheduler(registry, repos);

    // 模拟水位在第二条记录
    await repos.watermarks.upsert({
      source: 'csv', dataType: 'bar', symbol: 'CSI500',
      lastTimestamp: 1700086400000, updatedAt: Date.now(),
    });

    const csvContent = `symbol,timestamp,open,high,low,close,volume,turnover
CSI500,1700086400000,5050,5200,5000,5150,120000,600000000
CSI500,1700172800000,5150,5300,5100,5250,150000,750000000`;

    const task: CollectorTask = {
      id: 'e2e-incremental',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'csv',
      symbols: ['CSI500'],
      timeframes: [TimeFrame.D1],
      status: 'pending',
      createdAt: Date.now(),
    };

    const results = await scheduler.execute(task, { csvContent });
    expect(results[0].recordsWritten).toBe(2);

    const wm = await repos.watermarks.get('csv', 'bar', 'CSI500');
    expect(wm!.lastTimestamp).toBe(1700172800000);
  });

  it('instrument 采集流程', async () => {
    const registry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    const scheduler = new CollectorScheduler(registry, repos);

    const csvContent = `symbol,name,exchange,lotSize,priceTick,industry,sector,listDate,status
600519,贵州茅台,SSE,100,0.01,白酒,消费,998870400000,active`;

    const task: CollectorTask = {
      id: 'e2e-instrument',
      domain: CollectorDomain.Reference,
      dataType: 'instrument',
      source: 'csv',
      symbols: ['600519'],
      status: 'pending',
      createdAt: Date.now(),
    };

    const results = await scheduler.execute(task, { csvContent });
    expect(results).toHaveLength(1);
    expect(results[0].recordsWritten).toBe(1);

    const instruments = await instrumentRepo.query({ symbol: '600519' });
    expect(instruments.length).toBe(1);
    expect(instruments[0].name).toBe('贵州茅台');
    expect(instruments[0].lotSize).toBe(100);
  });
});
