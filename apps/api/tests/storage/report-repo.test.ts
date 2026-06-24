import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initApiDb, closeApiDb } from '../../src/storage/connection.js';
import { ReportRepository } from '../../src/storage/report-repo.js';
import type { BacktestReport } from '../../src/types.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('ReportRepository', () => {
  const testDbPath = resolve(process.cwd(), 'data', 'test-reports.db');

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    await initApiDb(testDbPath);
  });

  afterEach(() => {
    closeApiDb(false);
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('保存并查询报告', async () => {
    const repo = new ReportRepository();
    const report: BacktestReport = {
      id: 'report-1',
      taskId: 'task-1',
      strategyName: 'dual_ma',
      symbol: '600519',
      timeframe: '1d',
      startTime: 1704067200000,
      endTime: 1706745600000,
      createdAt: Date.now(),
      totalReturn: 0.15,
      annualizedReturn: 0.25,
      sharpeRatio: 1.5,
      maxDrawdown: -0.08,
      winRate: 0.6,
      totalTrades: 10,
      reportData: {
        id: 'report-1',
        status: 'completed',
        executiveSummary: {
          oneLineConclusion: '测试结论',
          recommendedForLive: true,
          keyMetrics: { annualizedReturn: 0.25, maxDrawdown: -0.08, sharpeRatio: 1.5 },
          riskPoints: [],
        },
      } as any,
    };

    await repo.save(report);
    const retrieved = await repo.getById('report-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('report-1');
    expect(retrieved?.strategyName).toBe('dual_ma');
  });

  it('按策略名称过滤', async () => {
    const repo = new ReportRepository();
    const reports: BacktestReport[] = [
      {
        id: 'report-1',
        taskId: 'task-1',
        strategyName: 'dual_ma',
        symbol: '600519',
        timeframe: '1d',
        createdAt: Date.now(),
        totalReturn: 0.1,
        annualizedReturn: 0.15,
        sharpeRatio: 1.2,
        maxDrawdown: -0.05,
        winRate: 0.5,
        totalTrades: 5,
        reportData: {} as any,
      },
      {
        id: 'report-2',
        taskId: 'task-2',
        strategyName: 'rsi',
        symbol: '000858',
        timeframe: '1d',
        createdAt: Date.now(),
        totalReturn: 0.2,
        annualizedReturn: 0.3,
        sharpeRatio: 1.8,
        maxDrawdown: -0.1,
        winRate: 0.7,
        totalTrades: 8,
        reportData: {} as any,
      },
    ];

    for (const r of reports) {
      await repo.save(r);
    }

    const dualMaReports = await repo.list({ strategyName: 'dual_ma' });
    expect(dualMaReports.length).toBe(1);
    expect(dualMaReports[0].strategyName).toBe('dual_ma');
  });
});