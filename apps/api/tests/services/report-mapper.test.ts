import { describe, it, expect } from 'vitest';
import { mapBacktestResultToReport } from '../../src/services/report-mapper.js';
import type { BacktestResult } from '../../src/types.js';

describe('mapBacktestResultToReport', () => {
  const baseResult: BacktestResult = {
    config: {
      initialCash: 1000000,
      slippage: 0.001,
    },
    trades: [],
    equityCurve: [
      { timestamp: 1704067200000, equity: 1000000 },
      { timestamp: 1706745600000, equity: 1100000 },
    ],
    drawdownCurve: [
      { timestamp: 1704067200000, drawdown: 0 },
      { timestamp: 1706745600000, drawdown: -0.08 },
    ],
    monthlyReturns: [
      { year: 2024, month: 1, return_pct: 0.05 },
    ],
    annualReturns: [
      { year: 2024, return_pct: 0.1 },
    ],
    metrics: {
      totalReturn: 0.1,
      annualizedReturn: 0.15,
      sharpeRatio: 1.5,
      maxDrawdown: -0.08,
      winRate: 0.6,
      totalTrades: 20,
      sortinoRatio: 1.8,
      calmarRatio: 1.5,
      annualizedVolatility: 0.12,
      maxDrawdownDuration: 45,
    },
    profitLossRatio: 2.5,
    avgHoldingDays: 12,
    maxSingleProfit: 15000,
    maxSingleLoss: -8000,
  };

  it('将 BacktestResult 转换为 BacktestReportFull', () => {
    const report = mapBacktestResultToReport(baseResult, {
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

  it('映射衍生统计指标（riskMetrics）', () => {
    const report = mapBacktestResultToReport(baseResult, {
      strategyName: 'test',
      symbol: '600519',
      timeframe: '1d',
    });

    // 真实值映射
    expect(report.riskMetrics.maxDrawdownDuration).toBe(45);
    expect(report.riskMetrics.annualizedVolatility).toBe(0.12);
    // 暂填 null 的字段
    expect(report.riskMetrics.var95).toBeNull();
    expect(report.riskMetrics.var99).toBeNull();
    expect(report.riskMetrics.cvar95).toBeNull();
    expect(report.riskMetrics.skewness).toBeNull();
    expect(report.riskMetrics.kurtosis).toBeNull();
  });

  it('映射衍生统计指标（riskAdjMetrics）', () => {
    const report = mapBacktestResultToReport(baseResult, {
      strategyName: 'test',
      symbol: '600519',
      timeframe: '1d',
    });

    expect(report.riskAdjMetrics.sortinoRatio).toBe(1.8);
    expect(report.riskAdjMetrics.calmarRatio).toBe(1.5);
    // informationRatio 暂填 null
    expect(report.riskAdjMetrics.informationRatio).toBeNull();
  });

  it('映射衍生统计指标（tradeStats）', () => {
    const report = mapBacktestResultToReport(baseResult, {
      strategyName: 'test',
      symbol: '600519',
      timeframe: '1d',
    });

    expect(report.tradeStats.profitLossRatio).toBe(2.5);
    expect(report.tradeStats.avgHoldingDays).toBe(12);
    expect(report.tradeStats.maxSingleProfit).toBe(15000);
    expect(report.tradeStats.maxSingleLoss).toBe(-8000);
    // annualTurnover 暂填 null
    expect(report.tradeStats.annualTurnover).toBeNull();
  });

  it('映射 equityData 字段（drawdownCurve 替代 drawdownSeries）', () => {
    const report = mapBacktestResultToReport(baseResult, {
      strategyName: 'test',
      symbol: '600519',
      timeframe: '1d',
    });

    expect(report.equityData.drawdownCurve).toBeDefined();
    expect(report.equityData.drawdownCurve).toEqual(baseResult.drawdownCurve);
    // 不应存在 drawdownSeries
    expect((report.equityData as Record<string, unknown>).drawdownSeries).toBeUndefined();
  });

  it('映射 equityData 字段（monthlyReturns/anualReturns 的 return_pct）', () => {
    const report = mapBacktestResultToReport(baseResult, {
      strategyName: 'test',
      symbol: '600519',
      timeframe: '1d',
    });

    expect(report.equityData.monthlyReturns[0].return_pct).toBe(0.05);
    expect(report.equityData.annualReturns[0].return_pct).toBe(0.1);
  });

  it('处理缺失字段为 null（不传衍生指标时）', () => {
    const minimalResult: BacktestResult = {
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
        sortinoRatio: 0,
        calmarRatio: 0,
        annualizedVolatility: 0,
        maxDrawdownDuration: 0,
      },
      profitLossRatio: 0,
      avgHoldingDays: 0,
      maxSingleProfit: 0,
      maxSingleLoss: 0,
    };

    const report = mapBacktestResultToReport(minimalResult, {
      strategyName: 'test',
      symbol: '600519',
      timeframe: '1d',
    });

    // 0 值应该映射为 0（valid number），不是 null
    expect(report.riskMetrics.maxDrawdownDuration).toBe(0);
    expect(report.riskAdjMetrics.sortinoRatio).toBe(0);
    expect(report.riskAdjMetrics.calmarRatio).toBe(0);
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
        sortinoRatio: 0,
        calmarRatio: 0,
        annualizedVolatility: 0,
        maxDrawdownDuration: 0,
      },
      profitLossRatio: 0,
      avgHoldingDays: 0,
      maxSingleProfit: 0,
      maxSingleLoss: 0,
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
