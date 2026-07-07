/**
 * Parquet 导入脚本 — 从本地 parquet 文件批量导入 K 线数据写入 data-center
 *
 * 用法:
 *   npx tsx src/commands/import-parquet.ts <rootDir> [timeframes...]
 *
 * 示例:
 *   npx tsx src/commands/import-parquet.ts E:/quant-data/bars daily
 *   npx tsx src/commands/import-parquet.ts E:/quant-data/bars daily weekly monthly quarterly yearly
 *
 * 默认（无参数）: rootDir=E:/quant-data/bars, timeframes=['daily']
 */
import { createDataCenter } from '../storage/factory.js';
import {
  AdapterRegistryImpl,
  CollectorScheduler,
  ParquetAdapter,
  CollectorDomain,
  type CollectorTask,
} from '@quant/data-collector';
import { TimeFrame } from '../base/types.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/** parquet 目录名 → TimeFrame 枚举值映射 */
const TIMEFRAME_MAP: Record<string, TimeFrame> = {
  daily: TimeFrame.D1,
  weekly: TimeFrame.W1,
  monthly: TimeFrame.Mo1,
  quarterly: TimeFrame.Q1,
  yearly: TimeFrame.Y1,
};

const DEFAULT_ROOT = 'E:/quant-data/bars';
const DEFAULT_TIMEFRAMES = ['daily'];

async function main() {
  const rootDir = process.argv[2] ?? DEFAULT_ROOT;
  const tfArgs = process.argv.slice(3);
  const timeframes = tfArgs.length > 0 ? tfArgs : DEFAULT_TIMEFRAMES;

  console.log(`[import-parquet] rootDir=${rootDir}`);
  console.log(`[import-parquet] timeframes=${timeframes.join(', ')}`);

  // 校验 timeframe 参数
  for (const tf of timeframes) {
    if (!TIMEFRAME_MAP[tf]) {
      console.error(`[import-parquet] 未知周期: ${tf}，支持: ${Object.keys(TIMEFRAME_MAP).join(', ')}`);
      process.exit(1);
    }
  }

  // 1. 连接 data-center
  console.log('[import-parquet] 初始化 data-center...');
  const dc = await createDataCenter();

  // 2. 创建采集器（仅 ParquetAdapter）
  const registry = new AdapterRegistryImpl();
  registry.register(new ParquetAdapter());
  const scheduler = new CollectorScheduler(registry, dc.repos);

  let totalFiles = 0;
  let totalRecords = 0;
  let failedFiles = 0;
  const startTime = Date.now();

  // 3. 遍历每个 timeframe 目录
  for (const tf of timeframes) {
    const dir = path.join(rootDir, tf);
    const timeframe = TIMEFRAME_MAP[tf];

    console.log(`\n[import-parquet] 扫描目录: ${dir} (timeframe=${timeframe})`);

    let files: string[];
    try {
      const entries = await fs.readdir(dir);
      files = entries.filter((f) => f.endsWith('.parquet')).sort();
    } catch (err) {
      console.error(`[import-parquet] 无法读取目录 ${dir}: ${err instanceof Error ? err.message : err}`);
      continue;
    }

    console.log(`[import-parquet] ${tf}: ${files.length} 个 parquet 文件`);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = path.join(dir, file);
      const symbol = file.replace(/\.parquet$/, '');

      const task: CollectorTask = {
        id: `parquet-${tf}-${symbol}-${Date.now()}`,
        domain: CollectorDomain.Market,
        dataType: 'bar',
        source: 'parquet',
        symbols: [symbol],
        timeframes: [timeframe],
        status: 'pending',
        createdAt: Date.now(),
      };

      try {
        const results = await scheduler.execute(task, { filePath });
        const written = results.reduce((sum, r) => sum + r.recordsWritten, 0);
        totalFiles++;
        totalRecords += written;

        if ((i + 1) % 100 === 0 || i === files.length - 1) {
          console.log(
            `[import-parquet] ${tf} 进度: ${i + 1}/${files.length} 文件, 累计 ${totalRecords} 条`
          );
        }
      } catch (err) {
        failedFiles++;
        console.error(
          `[import-parquet] ${symbol} ${tf} 失败: ${err instanceof Error ? err.message : err}`
        );
      }
    }
  }

  // 4. 保存并关闭
  dc.flush();
  await dc.close();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n[import-parquet] ===== 完成 =====');
  console.log(`[import-parquet] 总文件数: ${totalFiles}`);
  console.log(`[import-parquet] 总记录数: ${totalRecords}`);
  console.log(`[import-parquet] 失败文件: ${failedFiles}`);
  console.log(`[import-parquet] 耗时: ${duration}s`);
}

main().catch((err) => {
  console.error('[import-parquet] Fatal error:', err);
  process.exit(1);
});
