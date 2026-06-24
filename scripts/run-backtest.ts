/**
 * 端到端回测验证脚本 — 通过 PythonBridge 调用回测引擎
 *
 * 用法: npx tsx scripts/run-backtest.ts
 *
 * 前置条件:
 * - data/quant.db 已有数据（npx tsx scripts/seed-data.ts）
 * - Python 包已安装 (pip install -e .)
 *
 * 验证内容:
 * - dual_ma / rsi / bollinger_band 三策略 × 多标的
 * - 字段映射（camelCase）与 Python CLI 输出对齐
 * - 合理化检查：交易数 > 0、指标非 NaN、权益曲线非平坦
 */
import { PythonBridge } from "@quant/worker";
import { resolve } from "node:path";

const DB_PATH = resolve(import.meta.dirname, "..", "data", "quant.db");

interface BacktestMetrics {
  totalReturn: number;
  annualizedReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  totalTrades: number;
}

interface Trade {
  id: string;
  symbol: string;
  side: string;
  price: number;
  quantity: number;
  timestamp: number;
}

interface EquityPoint {
  timestamp: number;
  equity: number;
}

interface BacktestData {
  config: {
    strategyName: string;
    timeframe: string;
    startDate: number;
    endDate: number;
    initialCash: number;
    slippage: number;
  };
  metrics: BacktestMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];
  drawdownCurve?: Array<{ timestamp: number; drawdown: number }>;
  monthlyReturns?: Array<{ year: number; month: number; return_pct: number }>;
  annualReturns?: Array<{ year: number; return_pct: number }>;
}

interface StrategyCase {
  name: string;
  params: Record<string, unknown>;
}

const STRATEGIES: StrategyCase[] = [
  { name: "dual_ma", params: { short_period: 5, long_period: 20 } },
  { name: "rsi", params: { period: 14, oversold: 30, overbought: 70 } },
  { name: "bollinger_band", params: { period: 20, num_std: 2.0 } },
];

const SYMBOLS = ["600519", "000001", "300750"];

interface VerifyResult {
  strategy: string;
  symbol: string;
  ok: boolean;
  errors: string[];
  data?: BacktestData;
}

async function runBacktest(
  bridge: PythonBridge,
  strategy: string,
  symbol: string,
  params: Record<string, unknown>,
  initialCash = 1000000,
  slippage = 0.001,
): Promise<BacktestData> {
  const request = {
    command: "backtest",
    strategy,
    config: {
      initialCash,
      slippage,
      strategyParams: params,
    },
    dataRange: { dbPath: DB_PATH, symbol, timeframe: "1d" },
  };

  const result = await bridge.call(request);
  if (!result.ok) {
    throw new Error(result.error?.message ?? "Python backtest failed");
  }
  return result.data as BacktestData;
}

/** 合理化检查 */
function sanityCheck(strategy: string, symbol: string, data: BacktestData): string[] {
  const errors: string[] = [];
  const m = data.metrics;
  const ec = data.equityCurve;

  if (!m) {
    errors.push("metrics 为 undefined");
    return errors;
  }

  // 交易数检查
  const tradeCount = data.trades?.length ?? 0;
  if (tradeCount === 0) {
    errors.push(`交易数为 0（期望 > 0），策略未触发任何交易`);
  }

  // 指标非 NaN/Infinity
  const metricFields: Array<[string, number]> = [
    ["totalReturn", m.totalReturn],
    ["annualizedReturn", m.annualizedReturn],
    ["sharpeRatio", m.sharpeRatio],
    ["maxDrawdown", m.maxDrawdown],
    ["winRate", m.winRate],
  ];
  for (const [field, val] of metricFields) {
    if (typeof val !== "number" || Number.isNaN(val) || !Number.isFinite(val)) {
      errors.push(`metrics.${field} 无效: ${val}`);
    }
  }

  // 权益曲线非平坦
  if (!ec || ec.length < 2) {
    errors.push(`权益曲线点数不足: ${ec?.length ?? 0}`);
  } else {
    const first = ec[0].equity;
    const last = ec[ec.length - 1].equity;
    if (first === last) {
      errors.push(`权益曲线平坦: 首尾值均为 ${first}`);
    }
  }

  // 最大回撤应 > 0（有交易就有波动）
  if (typeof m.maxDrawdown === "number" && m.maxDrawdown <= 0 && tradeCount > 0) {
    errors.push(`maxDrawdown=${m.maxDrawdown}，有交易但无回撤（异常）`);
  }

  return errors;
}

function formatPct(v: number): string {
  return `${(v * 100).toFixed(2)}%`;
}

async function main(): Promise<void> {
  console.log("=== 端到端回测验证（PythonBridge）===\n");
  console.log(`数据库: ${DB_PATH}\n`);

  const bridge = new PythonBridge({ timeout: 120_000 });
  const results: VerifyResult[] = [];

  for (const strat of STRATEGIES) {
    for (const symbol of SYMBOLS) {
      const label = `${strat.name} @ ${symbol}`;
      console.log(`\n--- ${label} ---`);
      try {
        const data = await runBacktest(bridge, strat.name, symbol, strat.params);
        const errors = sanityCheck(strat.name, symbol, data);
        results.push({ strategy: strat.name, symbol, ok: errors.length === 0, errors, data });

        const m = data.metrics;
        const tradeCount = data.trades?.length ?? 0;
        const ecLen = data.equityCurve?.length ?? 0;
        console.log(`  权益曲线: ${ecLen} 点`);
        console.log(`  交易次数: ${tradeCount}`);
        console.log(`  总收益率: ${formatPct(m.totalReturn)}`);
        console.log(`  年化收益: ${formatPct(m.annualizedReturn)}`);
        console.log(`  最大回撤: ${formatPct(m.maxDrawdown)}`);
        console.log(`  夏普比率: ${m.sharpeRatio}`);
        console.log(`  胜率: ${formatPct(m.winRate)}`);

        // 前 3 笔交易明细
        if (tradeCount > 0) {
          console.log(`  前 3 笔交易:`);
          for (const t of data.trades.slice(0, 3)) {
            const date = new Date(t.timestamp).toISOString().slice(0, 10);
            console.log(`    ${date} ${t.side} ${t.quantity}@${t.price.toFixed(2)}`);
          }
        }

        if (errors.length > 0) {
          console.log(`  ⚠ 合理化检查失败:`);
          for (const e of errors) console.log(`    - ${e}`);
        } else {
          console.log(`  ✓ 合理化检查通过`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`  ✗ 回测失败: ${msg}`);
        results.push({ strategy: strat.name, symbol, ok: false, errors: [msg] });
      }
    }
  }

  // 汇总
  console.log("\n========== 验证汇总 ==========");
  console.log("策略            标的      交易数  总收益    年化      最大回撤  夏普    胜率    状态");
  console.log("--------------- --------  ------  -------- -------- --------  ------  ------  ----");
  let allOk = true;
  for (const r of results) {
    const m = r.data?.metrics;
    const tc = r.data?.trades?.length ?? 0;
    const tr = m ? formatPct(m.totalReturn) : "N/A";
    const ar = m ? formatPct(m.annualizedReturn) : "N/A";
    const md = m ? formatPct(m.maxDrawdown) : "N/A";
    const sr = m ? m.sharpeRatio.toFixed(2) : "N/A";
    const wr = m ? formatPct(m.winRate) : "N/A";
    const status = r.ok ? "✓ 通过" : "✗ 失败";
    if (!r.ok) allOk = false;
    console.log(
      `${r.strategy.padEnd(15)} ${r.symbol.padEnd(8)}  ${String(tc).padEnd(6)}  ${tr.padEnd(8)} ${ar.padEnd(8)} ${md.padEnd(8)}  ${sr.padEnd(6)}  ${wr.padEnd(6)}  ${status}`,
    );
  }

  console.log("");
  if (allOk) {
    console.log("=== 端到端回测验证全部通过 ===");
  } else {
    console.log("=== 端到端回测验证存在问题，请检查上方 ⚠/✗ 标记 ===");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(`端到端验证失败: ${err}`);
  process.exit(1);
});
