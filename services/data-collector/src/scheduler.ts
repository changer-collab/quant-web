import type { RepositorySet } from '@quant/data-center';
import type { AdapterRegistry } from './registry/types.js';
import type { AdapterFetchOptions } from './adapters/types.js';
import type { CollectorTask, CollectorResult, CollectorProgress } from './types.js';
import { DataCleaner } from './cleaner.js';

/** 分批写入的批次大小 */
const BATCH_SIZE = 500;

/**
 * 采集调度器 — 编排采集任务
 *
 * 职责：
 * 1. 根据任务查找适配器
 * 2. 读取水位决定增量起点
 * 3. 流式拉取原始数据，分批清洗写入数据中心（避免 OOM）
 * 4. 更新水位
 */
export class CollectorScheduler {
  constructor(
    private registry: AdapterRegistry,
    private repos: RepositorySet,
  ) {}

  /**
   * 执行单个采集任务
   * @param task 采集任务
   * @param extra 传递给适配器的额外参数
   * @param onProgress 进度回调（每写入一个批次触发一次）
   */
  async execute(
    task: CollectorTask,
    extra?: Record<string, unknown>,
    onProgress?: (progress: CollectorProgress) => void,
  ): Promise<CollectorResult[]> {
    const adapter = this.registry.get(task.source);
    if (!adapter) {
      throw new Error(`未注册的数据源: ${task.source}`);
    }

    const results: CollectorResult[] = [];
    const symbols = task.symbols;
    const timeframes = task.timeframes ?? [undefined];

    for (const symbol of symbols) {
      for (const tf of timeframes) {
        const start = await this.resolveStart(task.source, task.dataType, symbol, task.start);
        const fetchOptions: AdapterFetchOptions = {
          domain: task.domain,
          dataType: task.dataType,
          symbol,
          timeframe: tf,
          start,
          end: task.end,
          extra,
        };

        const startTime = Date.now();
        let recordsWritten = 0;
        let lastTimestamp = 0;
        let batchIndex = 0;

        // 根据数据源自动设置清洗器日期格式
        const prevDateFormat = DataCleaner.dateFormat;
        DataCleaner.dateFormat = this.inferDateFormat(task.source);

        // 流式分批写入：每 BATCH_SIZE 条记录清洗并写入一次
        let batch: Record<string, unknown>[] = [];
        for await (const record of adapter.fetch(fetchOptions)) {
          batch.push(record);
          if (batch.length >= BATCH_SIZE) {
            const written = await this.writeToDataCenter(task, batch, tf);
            recordsWritten += written;
            lastTimestamp = this.getLastTimestamp(batch, lastTimestamp);
            batchIndex++;
            onProgress?.({
              taskId: task.id,
              symbol,
              dataType: task.dataType,
              batchIndex,
              recordsWritten,
              lastTimestamp,
            });
            batch = [];
          }
        }

        // 写入剩余不足一个批次的记录
        if (batch.length > 0) {
          const written = await this.writeToDataCenter(task, batch, tf);
          recordsWritten += written;
          lastTimestamp = this.getLastTimestamp(batch, lastTimestamp);
          batchIndex++;
          onProgress?.({
            taskId: task.id,
            symbol,
            dataType: task.dataType,
            batchIndex,
            recordsWritten,
            lastTimestamp,
          });
        }

        // 更新水位
        if (lastTimestamp > 0) {
          await this.repos.watermarks.upsert({
            source: task.source,
            dataType: task.dataType,
            symbol,
            lastTimestamp,
            updatedAt: Date.now(),
          });
        }

        // 恢复清洗器日期格式
        DataCleaner.dateFormat = prevDateFormat;

        results.push({
          taskId: task.id,
          domain: task.domain,
          dataType: task.dataType,
          source: task.source,
          symbol,
          recordsWritten,
          lastTimestamp,
          duration: Date.now() - startTime,
        });
      }
    }

    return results;
  }

  /**
   * 解析增量采集起点 — 优先使用水位
   */
  async resolveStart(source: string, dataType: string, symbol: string, defaultStart?: number): Promise<number | undefined> {
    const wm = await this.repos.watermarks.get(source, dataType, symbol);
    if (wm) {
      return wm.lastTimestamp;
    }
    return defaultStart;
  }

  /** 将清洗后的数据写入数据中心 */
  private async writeToDataCenter(task: CollectorTask, rawRecords: Record<string, unknown>[], tf?: string): Promise<number> {
    if (rawRecords.length === 0) return 0;

    switch (task.dataType) {
      case 'bar': {
        const timeframe = (tf ?? '1d') as any;
        const bars = DataCleaner.cleanBars(rawRecords, timeframe);
        await this.repos.bars.save(bars);
        return bars.length;
      }
      case 'tick': {
        const ticks = DataCleaner.cleanTicks(rawRecords);
        await this.repos.ticks.save(ticks);
        return ticks.length;
      }
      case 'instrument': {
        const instruments = rawRecords.map((r) => DataCleaner.cleanInstrument(r));
        await this.repos.instruments.save(instruments);
        return instruments.length;
      }
      case 'financial_report': {
        const reports = DataCleaner.cleanFinancialReports(rawRecords);
        await this.repos.financialReports.save(reports);
        return reports.length;
      }
      case 'adjustment_factor': {
        const factors = DataCleaner.cleanAdjustmentFactors(rawRecords);
        await this.repos.adjustmentFactors.save(factors);
        return factors.length;
      }
      case 'calendar': {
        for (const r of rawRecords) {
          const calendar = DataCleaner.cleanTradingCalendar(r);
          await this.repos.calendars.save(calendar);
        }
        return rawRecords.length;
      }
      case 'announcement_event': {
        const events = DataCleaner.cleanAnnouncementEvents(rawRecords);
        await this.repos.announcementEvents.save(events);
        return events.length;
      }
      case 'news': {
        const articles = DataCleaner.cleanNewsArticles(rawRecords);
        await this.repos.news.save(articles);
        return articles.length;
      }
      case 'shareholder_metrics': {
        const metrics = DataCleaner.cleanShareholderMetricsBatch(rawRecords);
        await this.repos.shareholderMetrics.save(metrics);
        return metrics.length;
      }
      case 'valuation': {
        // 估值数据直接透传 RawDataRecord，由外部写入
        await this.repos.valuations.save(rawRecords as any);
        return rawRecords.length;
      }
      default:
        return 0;
    }
  }

  /** 从原始记录中提取最大时间戳（可传入当前最大值做增量比较） */
  private getLastTimestamp(rawRecords: Record<string, unknown>[], currentMax = 0): number {
    let max = currentMax;
    for (const r of rawRecords) {
      const ts = Number(r.timestamp) || 0;
      if (ts > max) max = ts;
    }
    return max;
  }

  /** 根据数据源推断日期格式 — Tushare 返回 YYYYMMDD，其他默认 auto */
  private inferDateFormat(source: string): 'auto' | 'yyyymmdd' | 'timestamp' {
    if (source === 'tushare') return 'yyyymmdd';
    return 'auto';
  }
}
