/**
 * 数据导入脚本 — 从 AKShare 拉取数据写入 data-center
 *
 * 用法: npx tsx src/commands/import-data.ts [symbols...]
 *       默认拉取 10 只蓝筹股近 1 年日K线
 */
import { createDataCenter } from '../storage/factory.js';
import { AdapterRegistryImpl, CollectorScheduler, CollectorPresets, AkshareAdapter } from '@quant/data-collector';

const DEFAULT_SYMBOLS = ['600519', '000001', '600036', '000858', '601318', '600276', '000333', '600900', '601166', '600887'];

async function main() {
  console.log('[import-data] Initializing data-center...');

  // 1. 连接 data-center 数据库
  const dc = await createDataCenter();

  // 2. 创建采集器（仅 AKShare）
  const registry = new AdapterRegistryImpl();
  registry.register(new AkshareAdapter());
  const scheduler = new CollectorScheduler(registry, dc.repos);

  // 3. 解析命令行参数
  const args = process.argv.slice(2);
  const symbols = args.length > 0 ? args : DEFAULT_SYMBOLS;

  console.log(`[import-data] Target symbols: ${symbols.join(', ')}`);

  // 4. 拉取标的列表
  console.log('[import-data] Fetching instruments...');
  const instrumentTask = CollectorPresets.instruments('akshare');
  try {
    const instrumentResults = await scheduler.execute(instrumentTask);
    const totalWritten = instrumentResults.reduce((sum, r) => sum + r.recordsWritten, 0);
    console.log(`[import-data] Instruments: ${totalWritten} records written`);
  } catch (err) {
    console.warn('[import-data] Instruments fetch failed (may already exist):', err instanceof Error ? err.message : err);
  }

  // 5. 拉取日K线
  const end = Date.now();
  const start = end - 365 * 24 * 60 * 60 * 1000; // 近 1 年

  for (const symbol of symbols) {
    console.log(`[import-data] Fetching daily bars for ${symbol}...`);
    const barTask = CollectorPresets.dailyBar(symbol, 'akshare', { start, end });
    try {
      const barResults = await scheduler.execute(barTask);
      const totalWritten = barResults.reduce((sum, r) => sum + r.recordsWritten, 0);
      console.log(`[import-data] ${symbol}: ${totalWritten} bars written`);
    } catch (err) {
      console.warn(`[import-data] ${symbol} bars fetch failed:`, err instanceof Error ? err.message : err);
    }
  }

  // 6. 保存并关闭
  dc.flush();
  await dc.close();
  console.log('[import-data] Done!');
}

main().catch((err) => {
  console.error('[import-data] Fatal error:', err);
  process.exit(1);
});
