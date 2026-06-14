/**
 * 数据质量校验实现
 */
import type { DataQualityChecker, DataQualityReport, ConsistencyIssue } from '../quality/types.js';
import { IssueSeverity } from '../quality/types.js';
import type { BarRepository, CalendarRepository } from '../repository/types.js';
import type { TimeFrame } from '../base/types.js';

export class DataQualityCheckerImpl implements DataQualityChecker {
  constructor(
    private barRepo: BarRepository,
    private calendarRepo?: CalendarRepository,
  ) {}

  /**
   * 基于交易日历计算期望交易日数量
   * 如果有日历数据则精确计算，否则回退到粗略估算
   */
  private async getExpectedTradingDays(start: number, end: number): Promise<number> {
    if (!this.calendarRepo) {
      return this.fallbackEstimate(start, end);
    }

    const startYear = new Date(start).getFullYear();
    const endYear = new Date(end).getFullYear();
    let totalTradingDays = 0;

    for (let year = startYear; year <= endYear; year++) {
      const cal = await this.calendarRepo.get('SSE', year);
      if (!cal) {
        // 无日历数据，回退
        return this.fallbackEstimate(start, end);
      }
      // 筛选在 [start, end] 范围内的交易日
      const inRange = cal.tradingDays.filter((ts) => ts >= start && ts <= end);
      totalTradingDays += inRange.length;
    }

    return Math.max(1, totalTradingDays);
  }

  /** 粗略估算：自然日 * 5/7 */
  private fallbackEstimate(start: number, end: number): number {
    const days = Math.ceil((end - start) / (24 * 60 * 60 * 1000));
    return Math.max(1, Math.round(days * 5 / 7));
  }

  async checkCompleteness(source: string, symbol: string, start: number, end: number): Promise<DataQualityReport> {
    const expectedDailyBars = await this.getExpectedTradingDays(start, end);
    const actualCount = await this.barRepo.count(symbol, '1d' as TimeFrame, start, end);
    const coverage = expectedDailyBars > 0 ? actualCount / expectedDailyBars : 0;
    const missingDates: number[] = [];

    return {
      source,
      dateRange: { start, end },
      totalExpected: expectedDailyBars,
      actualCount,
      missingDates,
      consistencyIssues: [],
      coverage: Math.min(coverage, 1),
      isAcceptable: coverage >= 0.95,
    };
  }

  async checkConsistency(source: string, symbol: string, start: number, end: number): Promise<DataQualityReport> {
    const bars = await this.barRepo.query(symbol, '1d' as TimeFrame, start, end);
    const issues: ConsistencyIssue[] = [];

    for (const bar of bars) {
      // high >= low
      if (bar.high < bar.low) {
        issues.push({
          symbol,
          timestamp: bar.timestamp,
          field: 'high/low',
          expectedValue: bar.low,
          actualValue: bar.high,
          severity: IssueSeverity.Error,
        });
      }
      // open/close 在 high-low 范围内
      if (bar.open > bar.high || bar.open < bar.low) {
        issues.push({
          symbol,
          timestamp: bar.timestamp,
          field: 'open',
          expectedValue: bar.high,
          actualValue: bar.open,
          severity: IssueSeverity.Warning,
        });
      }
      if (bar.close > bar.high || bar.close < bar.low) {
        issues.push({
          symbol,
          timestamp: bar.timestamp,
          field: 'close',
          expectedValue: bar.high,
          actualValue: bar.close,
          severity: IssueSeverity.Warning,
        });
      }
    }

    const coverage = bars.length > 0 ? (bars.length - issues.length) / bars.length : 0;
    return {
      source,
      dateRange: { start, end },
      totalExpected: bars.length,
      actualCount: bars.length,
      missingDates: [],
      consistencyIssues: issues,
      coverage,
      isAcceptable: issues.filter((i) => i.severity === IssueSeverity.Error).length === 0,
    };
  }

  async checkFreshness(source: string, symbol: string, maxStalenessMs: number): Promise<DataQualityReport> {
    const latest = await this.barRepo.getLatest(symbol, '1d' as TimeFrame);
    const now = Date.now();
    const issues: ConsistencyIssue[] = [];

    if (!latest) {
      return {
        source,
        dateRange: { start: 0, end: now },
        totalExpected: 1,
        actualCount: 0,
        missingDates: [],
        consistencyIssues: [],
        coverage: 0,
        isAcceptable: false,
      };
    }

    const staleness = now - latest.timestamp;
    if (staleness > maxStalenessMs) {
      issues.push({
        symbol,
        timestamp: latest.timestamp,
        field: 'freshness',
        expectedValue: maxStalenessMs,
        actualValue: staleness,
        severity: staleness > maxStalenessMs * 2 ? IssueSeverity.Error : IssueSeverity.Warning,
      });
    }

    return {
      source,
      dateRange: { start: latest.timestamp, end: now },
      totalExpected: 1,
      actualCount: 1,
      missingDates: [],
      consistencyIssues: issues,
      coverage: issues.length === 0 ? 1 : 0,
      isAcceptable: issues.length === 0,
    };
  }
}
