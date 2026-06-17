/**
 * 端到端回测验证脚本 — 通过 Python CLI 调用回测引擎
 *
 * 用法: npx tsx scripts/run-backtest.ts
 *
 * 前置条件:
 * - 已运行 seed-data.ts 采集数据
 * - Python 包已安装 (pip install -e .)
 */
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { writeFileSync, unlinkSync } from "node:fs";

const DB_PATH = resolve(import.meta.dirname, "..", "data", "quant.db");

interface BacktestMetrics {
  total_return: number;
  annualized_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
}

function runBacktest(
  strategy: string,
  symbol: string,
  initialCash = 1000000,
  slippage = 0.001,
) {
  const request = JSON.stringify({
    command: "backtest",
    strategy,
    config: { initialCash, slippage },
    dataRange: { dbPath: DB_PATH, symbol, timeframe: "1d" },
  });

  const tmpFile = resolve(import.meta.dirname, ".tmp-backtest-input.json");
  writeFileSync(tmpFile, request);

  try {
    // Windows PowerShell: Get-Content | python
    const output = execSync(
      `Get-Content "${tmpFile}" | python -m quantforge_strategy.cli`,
      { shell: "powershell", timeout: 60_000, encoding: "utf-8" },
    );
    return JSON.parse(output.trim());
  } finally {
    try { unlinkSync(tmpFile); } catch {}
  }
}

async function main(): Promise<void> {
  console.log("=== 端到端回测验证 ===\n");

  console.log("--- 双均线策略回测 (600519) ---");
  const result = runBacktest("dual_ma", "600519");

  if (result.ok && result.data) {
    const { metrics, trades, equity_curve } = result.data;
    console.log(`交易次数: ${trades?.length ?? 0}`);
    console.log(`权益曲线点数: ${equity_curve?.length ?? 0}`);
    if (metrics) {
      console.log(`\n--- 回测指标 ---`);
      console.log(`总收益率: ${(metrics.total_return * 100).toFixed(2)}%`);
      console.log(`年化收益率: ${(metrics.annualized_return * 100).toFixed(2)}%`);
      console.log(`最大回撤: ${(metrics.max_drawdown * 100).toFixed(2)}%`);
      console.log(`夏普比率: ${metrics.sharpe_ratio}`);
      console.log(`胜率: ${(metrics.win_rate * 100).toFixed(2)}%`);
    }
    console.log("\n=== 端到端回测验证通过 ===");
  } else {
    console.error(`回测失败: ${JSON.stringify(result.error)}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`端到端验证失败: ${err}`);
  process.exit(1);
});
