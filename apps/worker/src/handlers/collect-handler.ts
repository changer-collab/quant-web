import { TaskType } from '../types.js';
import type { TaskHandler, TaskRecord, TaskEventHandler } from '../queue.js';
import { resolveDbPath } from '../db-path.js';
import { createDataCenter } from '@quant/data-center/storage';
import { createCollector, CollectorPresets, CollectorScheduler } from '@quant/data-collector';

/** 数据采集任务参数 */
export interface CollectPayload {
  /** 数据源：baostock | akshare | csv | efinance | yfinance | tushare */
  source: string;
  /** 数据类型：bar | instrument */
  dataType: string;
  /** 标的列表（dataType='instrument' 时可省略） */
  symbols?: string[];
  /** 起始时间戳（毫秒） */
  start?: number;
  /** 结束时间戳（毫秒） */
  end?: number;
  /** 数据库路径，默认从环境变量或项目根解析 */
  dbPath?: string;
}

/** 数据采集任务处理器 — 通过 data-collector 采集数据写入数据中心 */
export class CollectHandler implements TaskHandler {
  readonly type = TaskType.Collect;

  async handle(task: TaskRecord, onEvent?: TaskEventHandler): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as CollectPayload;
    const dbPath = payload.dbPath ?? resolveDbPath();

    // 1. 创建数据中心（persistence: immediate 确保每批写入后 flush）
    const dc = await createDataCenter({ dbPath, persistence: 'immediate' });

    // 2. 创建采集器
    const { registry } = createCollector({
      sources: [payload.source as 'baostock' | 'akshare' | 'csv' | 'efinance' | 'yfinance' | 'tushare'],
    });
    const scheduler = new CollectorScheduler(registry, dc.repos);

    const details: Array<{ symbol: string; records: number; success: boolean; error?: string }> = [];
    let totalRecords = 0;

    try {
      if (payload.dataType === 'instrument') {
        // 采集标的列表（非阻塞，失败时记录但继续）
        const instrumentTask = CollectorPresets.instruments(payload.source);
        try {
          const results = await scheduler.execute(instrumentTask);
          for (const r of results) {
            totalRecords += r.recordsWritten;
            details.push({ symbol: '*', records: r.recordsWritten, success: true });
          }
        } catch (err) {
          details.push({
            symbol: '*',
            records: 0,
            success: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        if (onEvent) {
          onEvent({ event: 'progress', percent: 100, message: '标的列表采集完成' });
        }
      } else if (payload.dataType === 'bar') {
        const symbols = payload.symbols ?? [];
        const total = symbols.length;
        for (let i = 0; i < total; i++) {
          const symbol = symbols[i];
          const barTask = CollectorPresets.dailyBar(symbol, payload.source, {
            start: payload.start,
            end: payload.end,
          });
          try {
            const results = await scheduler.execute(barTask);
            for (const r of results) {
              totalRecords += r.recordsWritten;
              details.push({ symbol, records: r.recordsWritten, success: true });
            }
          } catch (err) {
            details.push({
              symbol,
              records: 0,
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
          if (onEvent) {
            onEvent({
              event: 'progress',
              percent: Math.round(((i + 1) / total) * 100),
              message: `采集 ${symbol} 完成 (${i + 1}/${total})`,
            });
          }
        }
      } else {
        throw new Error(`不支持的数据类型: ${payload.dataType}，当前仅支持 'bar' 和 'instrument'`);
      }
    } finally {
      await dc.close();
    }

    return { taskId: task.id, totalRecords, details } as Record<string, unknown>;
  }
}
