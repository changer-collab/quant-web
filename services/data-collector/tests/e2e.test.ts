/**
 * 端到端集成测试 — 从 CSV 采集到数据中心写入的完整流程
 *
 * 使用真实 SQLite（通过 createDataCenter），验证完整闭环：
 * CSV 适配器 → DataCleaner → data-center SQLite Repository → 水位更新
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDataCenter, type DataCenter } from '@quant/data-center/storage';
import { TimeFrame } from '@quant/data-center';
import { AdapterRegistryImpl, CsvAdapter, CollectorScheduler, CollectorDomain } from '../src/index.js';
import type { CollectorTask } from '../src/types.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('端到端集成测试（真实 SQLite）', () => {
  let dc: DataCenter;
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quant-e2e-'));
    dbPath = path.join(tmpDir, 'test.db');
    dc = await createDataCenter({ dbPath });
  });

  afterEach(async () => {
    await dc.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('CSV → 清洗 → 写入 data-center → 水位更新', async () => {
    const registry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    const scheduler = new CollectorScheduler(registry, dc.repos);

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

    // 验证数据已写入真实 SQLite
    const bars = await dc.repos.bars.query('CSI500', TimeFrame.D1);
    expect(bars.length).toBe(3);
    expect(bars[0].close).toBe(5050);

    // 验证水位已更新
    const wm = await dc.repos.watermarks.get('csv', 'bar', 'CSI500');
    expect(wm).toBeDefined();
    expect(wm!.lastTimestamp).toBe(1700172800000);
  });

  it('增量采集：水位之后只拉取新数据', async () => {
    const registry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    const scheduler = new CollectorScheduler(registry, dc.repos);

    // 模拟水位在第二条记录
    await dc.repos.watermarks.upsert({
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

    const wm = await dc.repos.watermarks.get('csv', 'bar', 'CSI500');
    expect(wm!.lastTimestamp).toBe(1700172800000);
  });

  it('instrument 采集流程', async () => {
    const registry = new AdapterRegistryImpl();
    registry.register(new CsvAdapter());
    const scheduler = new CollectorScheduler(registry, dc.repos);

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

    const instruments = await dc.repos.instruments.query({ symbol: '600519' });
    expect(instruments.length).toBe(1);
    expect(instruments[0].name).toBe('贵州茅台');
    expect(instruments[0].lotSize).toBe(100);
  });
});
