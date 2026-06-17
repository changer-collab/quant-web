import { CollectorDomain } from './types.js';
import type { CollectorTask, TaskStatus } from './types.js';
import type { TimeFrame } from '@quant/data-center';

let taskCounter = 0;

/**
 * 采集预设任务工厂
 *
 * 提供常用采集任务的预配置模板，调用方直接传入 symbol 和 source 即可。
 *
 * 示例：
 * ```ts
 * const task = CollectorPresets.dailyBar('600519', 'akshare');
 * const task2 = CollectorPresets.shareholderMetrics('600519', 'baostock');
 * ```
 */
export class CollectorPresets {
  /** 生成唯一任务 ID */
  private static nextId(): string {
    taskCounter++;
    return `task_${Date.now()}_${taskCounter}`;
  }

  /** 创建 CollectorTask 基础结构 */
  private static createTask(overrides: {
    domain: CollectorDomain;
    dataType: string;
    source: string;
    symbol?: string;
    symbols?: string[];
    timeframe?: string;
    start?: number;
    end?: number;
  }): CollectorTask {
    return {
      id: CollectorPresets.nextId(),
      domain: overrides.domain,
      dataType: overrides.dataType,
      source: overrides.source,
      symbols: overrides.symbols ?? (overrides.symbol ? [overrides.symbol] : []),
      timeframes: overrides.timeframe ? [overrides.timeframe as TimeFrame] : [],
      start: overrides.start,
      end: overrides.end,
      status: 'pending' as TaskStatus,
      createdAt: Date.now(),
    };
  }

  /** 日K线采集 */
  static dailyBar(symbol: string, source: string, options?: { start?: number; end?: number }): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Market,
      dataType: 'bar',
      symbol,
      source,
      timeframe: '1d',
      ...options,
    });
  }

  /** 分钟K线采集 */
  static minuteBar(symbol: string, source: string, timeframe: string, options?: { start?: number; end?: number }): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Market,
      dataType: 'bar',
      symbol,
      source,
      timeframe,
      ...options,
    });
  }

  /** 标的列表采集 */
  static instruments(source: string): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Reference,
      dataType: 'instrument',
      source,
    });
  }

  /** 交易日历采集 */
  static calendar(source: string, _year?: number): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Reference,
      dataType: 'calendar',
      source,
      symbol: 'SSE',
    });
  }

  /** 复权因子采集 */
  static adjustmentFactor(symbol: string, source: string, options?: { start?: number; end?: number }): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Reference,
      dataType: 'adjustment_factor',
      symbol,
      source,
      ...options,
    });
  }

  /** 财务报告采集 */
  static financialReport(symbol: string, source: string, options?: { start?: number; end?: number }): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Fundamental,
      dataType: 'financial_report',
      symbol,
      source,
      ...options,
    });
  }

  /** 股东人数采集 */
  static shareholderMetrics(symbol: string, source: string, options?: { start?: number; end?: number }): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Fundamental,
      dataType: 'shareholder_metrics',
      symbol,
      source,
      ...options,
    });
  }

  /** 估值数据采集 */
  static valuation(symbol: string, source: string, options?: { start?: number; end?: number }): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Fundamental,
      dataType: 'valuation',
      symbol,
      source,
      ...options,
    });
  }

  /** 新闻采集 */
  static news(symbol: string, source: string): CollectorTask {
    return CollectorPresets.createTask({
      domain: CollectorDomain.Event,
      dataType: 'news',
      symbol,
      source,
    });
  }

  /** 全量初始化：生成一组常用任务的初始采集任务 */
  static initAll(symbol: string, sources: Record<string, string>): CollectorTask[] {
    const tasks: CollectorTask[] = [];
    const add = (task: CollectorTask) => tasks.push(task);

    add(CollectorPresets.calendar(sources.calendar ?? 'tushare'));
    add(CollectorPresets.instruments(sources.instrument ?? 'akshare'));
    add(CollectorPresets.adjustmentFactor(symbol, sources.adjustment_factor ?? 'baostock'));
    add(CollectorPresets.dailyBar(symbol, sources.bar ?? 'akshare'));
    add(CollectorPresets.shareholderMetrics(symbol, sources.shareholder_metrics ?? 'baostock'));
    add(CollectorPresets.valuation(symbol, sources.valuation ?? 'baostock'));
    add(CollectorPresets.financialReport(symbol, sources.financial_report ?? 'baostock'));

    return tasks;
  }
}