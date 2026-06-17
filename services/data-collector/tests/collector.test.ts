import { describe, it, expect } from 'vitest';
import {
  CollectorDomain,
  type CollectorTask,
  type CollectorResult,
  type CollectorConfig,
} from '../src/types.js';

describe('采集层公共类型', () => {
  it('CollectorDomain 枚举包含所有数据子域', () => {
    expect(CollectorDomain.Reference).toBe('reference');
    expect(CollectorDomain.Market).toBe('market');
    expect(CollectorDomain.L2).toBe('l2');
    expect(CollectorDomain.Fundamental).toBe('fundamental');
    expect(CollectorDomain.Event).toBe('event');
  });

  it('CollectorTask 可正确构造', () => {
    const task: CollectorTask = {
      id: 'task-1',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'csv',
      symbols: ['CSI500'],
      timeframes: ['1d'],
      start: 1700000000000,
      end: 1700100000000,
      status: 'pending',
      createdAt: Date.now(),
    };
    expect(task.domain).toBe(CollectorDomain.Market);
    expect(task.symbols).toHaveLength(1);
  });

  it('CollectorResult 可正确构造', () => {
    const result: CollectorResult = {
      taskId: 'task-1',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      source: 'csv',
      symbol: 'CSI500',
      recordsWritten: 100,
      lastTimestamp: 1700100000000,
      duration: 500,
    };
    expect(result.recordsWritten).toBe(100);
  });

  it('CollectorConfig 可正确构造', () => {
    const config: CollectorConfig = {
      source: 'csv',
      domain: CollectorDomain.Market,
      dataType: 'bar',
      options: { filePath: 'data/bars.csv' },
    };
    expect(config.source).toBe('csv');
  });
});
