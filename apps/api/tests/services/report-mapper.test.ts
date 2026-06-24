import { describe, it, expect } from 'vitest';
import { mapBacktestResultToReport } from '../../src/services/report-mapper.js';
import type { BacktestResult } from '../../src/types.js';

describe('mapBacktestResultToReport', () => {
  it('将 BacktestResult 转换为 BacktestReportFull', () => {
    const result: BacktestResult = {
      config: {
        initialCash: 1000000,
        slippage: 0.001,
      },
      trades: [],
      equityCurve: [
        { timestamp: 1704067200000, equity: 1000000 },
        { timestamp: 1706745600000, equity: 1100000 },
      ],
      metrics: {
        totalReturn: 0.1,
        annualizedReturn: 0.15,
        sharpeRatio: 1.5,
        maxDrawdown: -0.08,
        winRate: 0.6,
        totalTrades: 20,
      },
    };

    const report = mapBacktestResultToReport(result, {
      strategyName: 'dual_ma',
      symbol: '600519',
      timeframe: '1d',
      startTime: 1704067200000,
      endTime: 1706745600000,
    });

    expect(report).toBeDefined();
    expect(report.executiveSummary).toBeDefined();
    expect(report.overview.name).toBe('dual_ma');
    expect(report.returnMetrics.cumulativeReturn).toBe(0.1);
    expect(report.riskMetrics.maxDrawdown).toBe(-0.08);
    expect(report.tradeStats.totalTrades).toBe(20);
  });

  it('生成空风险点（AI 分析阶段填充）', () => {
    const result: BacktestResult = {
      config: {},
      trades: [],
      equityCurve: [],
      metrics: {
        totalReturn: 0.05,
        annualizedReturn: 0.08,
        sharpeRatio: 0.8,
        maxDrawdown: -0.35,
        winRate: 0.35,
        totalTrades: 8,
      },
    };

    const report = mapBacktestResultToReport(result, {
      strategyName: 'test',
      symbol: '600519',
      timeframe: '1d',
    });

    // report-mapper 不生成 riskPoints/redLines，由 AI 分析阶段填充
    expect(report.executiveSummary.riskPoints).toEqual([]);
    expect(report.riskWarnings.redLines).toEqual([]);
    // 但核心指标必须正确映射
    expect(report.riskMetrics.maxDrawdown).toBe(-0.35);
    expect(report.tradeStats.totalTrades).toBe(8);
    expect(report.tradeStats.winRate).toBe(0.35);
  });
});