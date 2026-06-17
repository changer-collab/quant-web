import { describe, it, expect, beforeEach } from 'vitest';
import { CollectorScheduler } from '../src/scheduler.js';
import { AdapterRegistryImpl } from '../src/registry/index.js';
import { CsvAdapter } from '../src/adapters/csv-adapter.js';
import type { RepositorySet, Watermark } from '@quant/data-center';
import type { CollectorTask } from '../src/types.js';
import { CollectorDomain } from '../src/types.js';
import { TimeFrame } from '@quant/data-center';

/** 内存版 WatermarkRepository，用于测试 */
class InMemoryWatermarkRepo {
  private data = new Map<string, Watermark>();
  private key(source: string, dataType: string, symbol: string) {
    return `${source}:${dataType}:${symbol}`;
  }
  async get(source: string, dataType: string, symbol: string): Promise<Watermark | undefined> {
    return this.data.get(this.key(source, dataType, symbol));
  }
  async upsert(wm: Watermark): Promise<void> {
    this.data.set(this.key(wm.source, wm.dataType, wm.symbol), wm);
  }
  async list(source: string, dataType?: string): Promise<Watermark[]> {
    return [...this.data.values()].filter(
      (w) => w.source === source && (dataType === undefined || w.dataType === dataType),
    );
  }
}

/** 内存版 BarRepository，用于测试 */
class InMemoryBarRepo {
  private bars: any[] = [];
  async save(bars: any[]): Promise<void> {
    this.bars.push(...bars);
  }
  getBars() { return this.bars; }
}

function createMockRepos() {
  const watermarkRepo = new InMemoryWatermarkRepo();
  const barRepo = new InMemoryBarRepo();
  return {
    watermarks: watermarkRepo,
    bars: barRepo as any,
  } as unknown as RepositorySet;
}

describe('CollectorScheduler', () => {
  let scheduler: CollectorScheduler;
  let registry: AdapterRegistryImpl;
  let repos: RepositorySet;

  beforeEach(() => {
    registry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    repos = createMockRepos();
    scheduler = new CollectorScheduler(registry, repos);
  });

  it('提交任务并执行采集', async () => {
    const csvContent = `symbol,timestamp,open,high,low,close,volume,turnover
CSI500,1700000000000,5000,5100,4900,5050,100000,500000000`;
    const task: CollectorTask = {
      id: 'task-1',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'csv',
      symbols: ['CSI500'],
      timeframes: [TimeFrame.D1],
      start: 1700000000000,
      end: 1700100000000,
      status: 'pending',
      createdAt: Date.now(),
    };

    const results = await scheduler.execute(task, { csvContent });
    expect(results).toHaveLength(1);
    expect(results[0].recordsWritten).toBe(1);
    expect(results[0].symbol).toBe('CSI500');
  });

  it('执行后更新水位', async () => {
    const csvContent = `symbol,timestamp,open,high,low,close,volume,turnover
CSI500,1700000000000,5000,5100,4900,5050,100000,500000000
CSI500,1700086400000,5050,5200,5000,5150,120000,600000000`;
    const task: CollectorTask = {
      id: 'task-2',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'csv',
      symbols: ['CSI500'],
      timeframes: [TimeFrame.D1],
      status: 'pending',
      createdAt: Date.now(),
    };

    await scheduler.execute(task, { csvContent });

    const wm = await repos.watermarks.get('csv', 'bar', 'CSI500');
    expect(wm).toBeDefined();
    expect(wm!.lastTimestamp).toBe(1700086400000);
  });

  it('增量采集：水位之后的 start', async () => {
    // 先设置水位
    await repos.watermarks.upsert({
      source: 'csv', dataType: 'bar', symbol: 'CSI500',
      lastTimestamp: 1700000000000, updatedAt: Date.now(),
    });

    const start = await scheduler.resolveStart('csv', 'bar', 'CSI500', 1600000000000);
    expect(start).toBe(1700000000000); // 使用水位而非传入的 start
  });

  it('无水位时使用传入的 start', async () => {
    const start = await scheduler.resolveStart('csv', 'bar', 'CSI500', 1600000000000);
    expect(start).toBe(1600000000000);
  });

  it('不支持的 source 抛错', async () => {
    const task: CollectorTask = {
      id: 'task-err',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'nonexistent',
      symbols: ['CSI500'],
      status: 'pending',
      createdAt: Date.now(),
    };
    await expect(scheduler.execute(task)).rejects.toThrow('未注册的数据源');
  });

  it('进度回调在写入批次后触发', async () => {
    const csvContent = `symbol,timestamp,open,high,low,close,volume,turnover
CSI500,1700000000000,5000,5100,4900,5050,100000,500000000
CSI500,1700086400000,5050,5200,5000,5150,120000,600000000`;
    const task: CollectorTask = {
      id: 'task-progress',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'csv',
      symbols: ['CSI500'],
      timeframes: [TimeFrame.D1],
      status: 'pending',
      createdAt: Date.now(),
    };

    const progressCalls: any[] = [];
    const results = await scheduler.execute(task, { csvContent }, (progress) => {
      progressCalls.push(progress);
    });
    expect(results).toHaveLength(1);
    expect(results[0].recordsWritten).toBe(2);
    // 至少触发一次进度回调（最后一批）
    expect(progressCalls.length).toBeGreaterThanOrEqual(1);
    expect(progressCalls[0].taskId).toBe('task-progress');
    expect(progressCalls[0].dataType).toBe('bar');
  });
});
