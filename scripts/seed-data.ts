/**
 * 数据采集脚本 — 用 baostock 拉取真实 A 股行情写入 data-center
 *
 * 用法: npx tsx scripts/seed-data.ts
 *
 * 默认拉取：
 * - 贵州茅台(600519) 日K线 2023-01-01 ~ 2024-12-31
 * - 标的列表
 *
 * 前置条件：
 * - Python 3.8+ 且已安装 baostock（pip install baostock）
 */
import { createDataCenter } from "@quant/data-center/storage";
import { createCollector, CollectorPresets, CollectorScheduler } from "@quant/data-collector";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const DB_PATH = resolve(import.meta.dirname, "..", "data", "quant.db");
const SYMBOLS = ["600519", "000001", "600036"]; // 贵州茅台、平安银行、招商银行
const START_DATE = new Date("2023-01-01").getTime();
const END_DATE = new Date("2024-12-31").getTime();

async function main(): Promise<void> {
  console.log("=== 数据采集开始 ===\n");

  // 1. 确保 data 目录存在
  mkdirSync(join(import.meta.dirname, "..", "data"), { recursive: true });

  // 2. 创建数据中心
  const dc = await createDataCenter({ dbPath: DB_PATH, persistence: "immediate" });
  console.log(`数据中心已创建: ${DB_PATH}`);

  // 3. 创建采集器（只用 baostock，AKShare 在国内网络可能不稳定）
  const { registry } = createCollector({ sources: ["baostock"] });
  const scheduler = new CollectorScheduler(registry, dc.repos);

  // 4. 采集标的列表
  console.log("\n--- 采集标的列表 ---");
  const instrumentTask = CollectorPresets.instruments("baostock");
  try {
    const results = await scheduler.execute(instrumentTask);
    for (const r of results) {
      console.log(`  标的列表: 写入 ${r.recordsWritten} 条, 耗时 ${r.duration}ms`);
    }
  } catch (err) {
    console.warn(`  标的列表采集失败（非阻塞）: ${err}`);
  }

  // 5. 采集日K线
  for (const symbol of SYMBOLS) {
    console.log(`\n--- 采集 ${symbol} 日K线 ---`);
    const barTask = CollectorPresets.dailyBar(symbol, "baostock", {
      start: START_DATE,
      end: END_DATE,
    });
    try {
      const results = await scheduler.execute(barTask);
      for (const r of results) {
        console.log(
          `  ${symbol}: 写入 ${r.recordsWritten} 条, 最后时间戳 ${r.lastTimestamp}, 耗时 ${r.duration}ms`,
        );
      }
    } catch (err) {
      console.error(`  ${symbol} 日K线采集失败: ${err}`);
    }
  }

  // 6. 关闭数据中心
  await dc.close();
  console.log("\n=== 数据采集完成，数据库已保存 ===");
}

main().catch((err) => {
  console.error(`数据采集失败: ${err}`);
  process.exit(1);
});
