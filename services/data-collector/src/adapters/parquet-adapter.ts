import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
  ParquetExtra,
} from './types.js';

const execFileAsync = promisify(execFile);

/** 默认 timeframe 映射：parquet 字面量 → TimeFrame 枚举值 */
const DEFAULT_TIMEFRAME_MAP: Record<string, string> = {
  daily: '1d',
  weekly: '1w',
  monthly: '1mo',
  quarterly: '1q',
  yearly: '1y',
};

/**
 * Parquet 适配器 — 通过 Python 子进程调用 pyarrow 流式读取 parquet 文件
 *
 * 适用场景：读取本地 parquet 文件（如 E:\quant-data\bars\*），写入数据中心。
 *
 * 依赖：
 * - Python 3.8+ 且已安装 pyarrow（pip install pyarrow）
 * - 可通过 extra.pythonPath 指定 Python 路径
 *
 * 流式策略：
 * - pyarrow.ParquetFile.iter_batches(batch_size) 分批读取
 * - batch.to_pylist() 转 dict 列表（不依赖 pandas）
 * - 逐行 print(json.dumps(row))，TS 侧按行解析 NDJSON
 *
 * timeframe 映射：
 * - parquet 文件 timeframe 字段为 daily/weekly/monthly/quarterly/yearly
 * - 映射为 data-center TimeFrame 枚举值 1d/1w/1mo/1q/1y
 * - 可通过 extra.timeframeMap 覆盖默认映射
 */
export class ParquetAdapter implements DataSourceAdapter {
  name = 'parquet';
  supportedDomains = ['market'];
  supportedDataTypes = ['bar', 'tick', 'trade_record', 'order_record', 'l2_snapshot'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as ParquetExtra | undefined;
    if (!extra?.filePath && !extra?.fileDir) {
      throw new Error('ParquetAdapter 需要 extra.filePath 或 extra.fileDir');
    }

    const pythonPath = extra?.pythonPath ?? 'python';
    const batchSize = extra?.batchSize ?? 1000;
    const timeframeMap = { ...DEFAULT_TIMEFRAME_MAP, ...(extra?.timeframeMap ?? {}) };
    const files = extra?.filePath ? [extra.filePath] : await this.listParquetFiles(extra!.fileDir!);

    for (const filePath of files) {
      const script = this.buildScript(filePath, batchSize, timeframeMap);
      const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
        maxBuffer: 500 * 1024 * 1024,
        timeout: 600_000,
      });

      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed) as RawDataRecord;
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  }

  /** 列出目录下所有 .parquet 文件 */
  private async listParquetFiles(dir: string): Promise<string[]> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const entries = await fs.readdir(dir);
    return entries
      .filter((f) => f.endsWith('.parquet'))
      .map((f) => path.join(dir, f))
      .sort();
  }

  private buildScript(
    filePath: string,
    batchSize: number,
    timeframeMap: Record<string, string>
  ): string {
    const timeframeMapJson = JSON.stringify(timeframeMap);
    const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    return `
import json, sys
import pyarrow.parquet as pq

file_path = '${escapedPath}'
batch_size = ${batchSize}
timeframe_map = ${timeframeMapJson}

pf = pq.ParquetFile(file_path)
for batch in pf.iter_batches(batch_size=batch_size):
    rows = batch.to_pylist()
    for row in rows:
        tf = str(row.get('timeframe', ''))
        record = {
            'symbol': str(row['symbol']),
            'timeframe': timeframe_map.get(tf, tf),
            'timestamp': int(row['timestamp']),
            'open': float(row['open']),
            'high': float(row['high']),
            'low': float(row['low']),
            'close': float(row['close']),
            'volume': float(row['volume']),
            'turnover': float(row.get('turnover', 0) or 0),
        }
        if 'openInterest' in row and row['openInterest'] is not None:
            record['openInterest'] = float(row['openInterest'])
        if 'numTrades' in row and row['numTrades'] is not None:
            record['numTrades'] = int(row['numTrades'])
        print(json.dumps(record, default=str))
`;
  }
}
