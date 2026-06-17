# 真实数据接入与端到端验证 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 接入 AKShare 真实 A 股行情数据，跑通"数据采集 → 写入数据中心 → Python 回测引擎读取 → 输出回测结果"的完整闭环，使策略开发可以正式启动。

**Architecture:** data-collector（TS）通过 AKShare 适配器调用 Python 子进程拉取行情 → DataCleaner 清洗 → 写入 data-center 的 SQLite → data-client-py（Python）读取 SQLite → BacktestRunner 执行回测 → 返回 BacktestResult。Worker 通过 PythonBridge 调用 CLI 入口串联全流程。

**Tech Stack:** AKShare（Python 数据源）、sql.js/Drizzle ORM（TS 数据中心）、quantforge-data（Python 数据客户端）、quantforge-backtest（Python 回测引擎）

---

## 当前进度

> **最后更新：** 2026-06-17

### 整体进度：部分完成（约 80%）

| Task | 状态 | 说明 |
|------|------|------|
| Task 1: 环境准备 — 安装 Baostock | ✅ 已完成 | 适配器已就绪 |
| Task 2: 修复适配器 Windows 兼容性 | ✅ 已完成 | `python3 → python` 已修复 |
| Task 3: 修复 DataClient 列名映射 | ✅ 已完成 | data-center schema 对齐 |
| Task 4: 创建数据采集脚本 | ✅ 已完成 | `scripts/seed-data.ts` 已跑通，采集 3 标的各 484 bars |
| Task 5: 端到端回测验证 — Python CLI | ✅ 已完成 | CLI 用真实数据跑通单标的 + 组合策略回测 |
| Task 6: 编写端到端集成测试 | ⚠️ 部分完成 | `e2e.test.ts` 仍使用内存 mock 替代真实 SQLite |
| Task 7: 全量验证 + 文档更新 | ⚠️ 部分完成 | CLI 文档已更新，PostgreSQL 后端未实现 |

### 已实现

- `services/data-collector/src/adapters/` 下 6 个适配器（akshare/baostock/csv/efinance/tushare/yfinance）
- `services/data-center/` 完整的 6 子域存储（reference/market/l2/fundamental/event/quality）
- `packages/data-client/quantforge_data/client.py` Python 数据客户端
- `packages/strategy-runtime/quantforge_strategy/commands/backtest.py` CLI 回测命令（支持单标的/组合策略）
- data-collector 的 cleaner、scheduler、registry 模块
- **真实数据采集已跑通**：`npx tsx scripts/seed-data.ts` 通过 baostock 拉取 600519/000001/600036 日K线
- **CLI 端到端回测已验证**：
  - 单标的：dual_ma 策略 484 bars、33 笔交易
  - 组合策略：3 标的、50 笔交易、动量选股 + 均线择时 + 等权仓位

### 未完成

- `e2e.test.ts` 明确注释"使用内存 mock 替代真实 SQLite，避免 sql.js WASM 路径问题"
- PostgreSQL 存储后端仅有 README，未实现
- 真实 AKShare 适配器未实际调用验证（baostock 已验证）

### 阻塞原因

- sql.js WASM 在测试环境中的路径问题（影响 TS 层 e2e 测试）
- PostgreSQL 后端需要额外基础设施

---

## 依赖关系确认

### TS 层依赖链

```
data-collector → data-center（唯一依赖，通过 RepositorySet 写入）
```

data-collector 不依赖 api、worker、web 或任何 packages/*。

### Python 层依赖链

```
strategies → strategy-runtime
backtest-engine → strategy-runtime
data-client → strategy-runtime（re-export Bar/TimeFrame 等行情类型）
factor-lab → strategy-runtime
ai-engine → data-client
```

### TS ↔ Python 通信

```
Worker(TS) → PythonBridge → python -m quantforge_strategy.cli → commands/backtest.py
                                                              → commands/factor_eval.py
                                                              → commands/ai_train.py
```

commands/backtest.py 内部调用链：
```
get_strategy(strategy_name) → DataClient(db_path).query_bars() → BacktestRunner(strategy, bars).run()
```

### 数据流

```
AKShare API → AkshareAdapter(TS, Python子进程) → DataCleaner → data-center SQLite
                                                                    ↓
DataClient(Python, 读 SQLite) → BacktestRunner → BacktestResult JSON → Worker(TS)
```

---

## 验证范围（当前阶段）

| 类别 | 项目 | 状态 |
|------|------|------|
| 代码质量 | Lint + Type check 通过 | 需要 |
| 代码质量 | Code Review 闭环 | 不需要 |
| 自动化测试 | 单元测试全通过 | 需要 |
| 自动化测试 | 端到端集成验证 | 需要（本计划核心） |
| 自动化测试 | E2E 覆盖率 80%+ | 不需要 |
| 安全审查 | 密钥扫描（无硬编码 token） | 需要 |
| 安全审查 | npm audit / SQL 注入 | 不需要 |
| 性能验证 | 全部 | 不需要 |
| 基础设施 | 全部 | 不需要 |
| 可观测性 | 全部 | 不需要 |

---

## File Structure

### 新建文件

```
scripts/
  seed-data.ts              — 数据采集脚本：用 data-collector 拉取 AKShare 数据写入 data-center
  run-backtest.ts           — 端到端回测验证脚本：Worker → Python CLI → 回测结果

data/
  quant.db                  — SQLite 数据库文件（运行时生成，.gitignore 已排除）
```

### 修改文件

```
services/data-collector/src/adapters/akshare-adapter.ts  — 修复 Windows 兼容性（python3 → python）
services/data-collector/src/bootstrap.ts                  — 导出 createCollectorWithRepos 便捷函数
packages/data-client/quantforge_data/client.py            — 修复 schema 列名映射（与 data-center Drizzle schema 对齐）
packages/strategy-runtime/quantforge_strategy/commands/backtest.py — 增强错误处理
```

---

## Task 1: 环境准备 — 安装 Baostock 并验证可用

> **状态: ✅ 已完成**
> - Python 3.13.12 已安装
> - baostock 0.9.2 已安装
> - 验证脚本成功拉取茅台日K线

**Files:**
- Create: `scripts/check-env.ts`

- [ ] **Step 1: 编写环境检查脚本**

```typescript
// scripts/check-env.ts
/**
 * 环境检查脚本 — 验证 AKShare 和 Python 环境可用
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

async function checkPython(): Promise<void> {
  try {
    const { stdout } = await exec("python", ["--version"]);
    console.log(`Python: ${stdout.trim()}`);
  } catch {
    throw new Error("Python 未安装或不在 PATH 中");
  }
}

async function checkAkshare(): Promise<void> {
  const script = `
import json
try:
  import akshare as ak
  df = ak.stock_zh_a_hist(symbol="600519", period="daily", start_date="20240101", end_date="20240110", adjust="qfq")
  print(json.dumps({"ok": True, "rows": len(df), "columns": list(df.columns)}))
except Exception as e:
  print(json.dumps({"ok": False, "error": str(e)}))
`;
  const { stdout } = await exec("python", ["-c", script], { timeout: 30_000 });
  const result = JSON.parse(stdout.trim());
  if (!result.ok) {
    throw new Error(`AKShare 不可用: ${result.error}`);
  }
  console.log(`AKShare: 可用，测试查询返回 ${result.rows} 行，列: ${result.columns.join(", ")}`);
}

async function main(): Promise<void> {
  console.log("=== 环境检查 ===\n");
  await checkPython();
  await checkAkshare();
  console.log("\n=== 环境检查通过 ===");
}

main().catch((err) => {
  console.error(`\n环境检查失败: ${err.message}`);
  process.exit(1);
});
```

- [ ] **Step 2: 运行环境检查**

Run: `npx tsx scripts/check-env.ts`
Expected: 输出 Python 版本和 AKShare 可用信息

- [ ] **Step 3: 如果 AKShare 未安装，安装它**

Run: `pip install akshare`

- [ ] **Step 4: 重新运行环境检查确认通过**

Run: `npx tsx scripts/check-env.ts`
Expected: `=== 环境检查通过 ===`

---

## Task 2: 修复适配器 Windows 兼容性 (python3 → python)

> **状态: ✅ 已完成**
> - 修复 akshare/baostock/efinance/yfinance 4个适配器
> - 修复 types.ts 注释中的 python3 引用

**Files:**
- Modify: `services/data-collector/src/adapters/akshare-adapter.ts:14`

当前 AkshareAdapter 默认使用 `python3`，Windows 上 Python 可执行文件名是 `python`（无 `3` 后缀）。

- [ ] **Step 1: 编写测试验证当前行为在 Windows 上会失败**

```typescript
// 在 services/data-collector/tests/adapter.test.ts 中添加
it("AkshareAdapter 默认 pythonPath 在 Windows 上应为 python", () => {
  const adapter = new AkshareAdapter();
  // 验证适配器可以构造，且 extra.pythonPath 可覆盖
  expect(adapter.name).toBe("akshare");
  expect(adapter.supportedDomains).toContain("market");
});
```

- [ ] **Step 2: 运行测试确认当前行为**

Run: `cd services/data-collector && npx vitest run tests/adapter.test.ts`
Expected: PASS

- [ ] **Step 3: 修改 AkshareAdapter 默认 pythonPath**

将 `services/data-collector/src/adapters/akshare-adapter.ts` 第 14 行：

```typescript
const pythonPath = extra?.pythonPath ?? 'python3';
```

改为：

```typescript
const pythonPath = extra?.pythonPath ?? 'python';
```

- [ ] **Step 4: 运行 data-collector 全部测试**

Run: `cd services/data-collector && npx vitest run`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add services/data-collector/src/adapters/akshare-adapter.ts
git commit -m "fix: akshare adapter default pythonPath to 'python' for Windows compatibility"
```

---

## Task 3: 修复 DataClient 列名映射与 data-center schema 对齐

**Files:**
- Modify: `packages/data-client/quantforge_data/client.py`

DataClient 的 `query_bars` 用 `SELECT *` 查询，然后按列索引映射。需要确认 data-center 的 Drizzle schema 列顺序与 DataClient 的索引映射一致。

- [ ] **Step 1: 读取 data-center 的 bars schema 确认列顺序**

读取 `services/data-center/src/storage/schema.ts`，确认 bars 表的列定义顺序。

- [ ] **Step 2: 编写测试验证 DataClient 列映射**

```python
# packages/data-client/tests/test_client.py 新增测试
def test_query_bars_column_mapping(tmp_path):
    """验证 DataClient 读取的 Bar 字段与 data-center schema 对齐"""
    import sqlite3
    db_path = tmp_path / "test.db"
    conn = sqlite3.connect(str(db_path))
    # 创建与 data-center schema 一致的表
    conn.execute("""
        CREATE TABLE bars (
            symbol TEXT NOT NULL,
            timeframe TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            volume REAL NOT NULL,
            turnover REAL,
            open_interest REAL,
            num_trades INTEGER,
            PRIMARY KEY (symbol, timeframe, timestamp)
        )
    """)
    conn.execute(
        "INSERT INTO bars VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ["600519", "1d", 1700000000000, 1800.0, 1850.0, 1790.0, 1830.0, 50000, 90000000, None, None],
    )
    conn.commit()
    conn.close()

    from quantforge_data import DataClient
    from quantforge_strategy import TimeFrame

    client = DataClient(str(db_path))
    bars = client.query_bars("600519", TimeFrame.D1)
    assert len(bars) == 1
    bar = bars[0]
    assert bar.symbol == "600519"
    assert bar.timeframe == TimeFrame.D1
    assert bar.open == 1800.0
    assert bar.high == 1850.0
    assert bar.low == 1790.0
    assert bar.close == 1830.0
    assert bar.volume == 50000
```

- [ ] **Step 3: 运行测试**

Run: `cd packages/data-client && python -m pytest tests/test_client.py -v`
Expected: 如果列映射不对则 FAIL，需要修复

- [ ] **Step 4: 修复 DataClient 列映射（如需要）**

如果测试失败，修改 `packages/data-client/quantforge_data/client.py` 中的 `query_bars` 方法，改用列名映射而非列索引：

```python
def query_bars(self, symbol: str, timeframe: TimeFrame, start_ts: int | None = None, end_ts: int | None = None) -> list[Bar]:
    conn = self._connect()
    try:
        sql = "SELECT * FROM bars WHERE symbol = ? AND timeframe = ?"
        params: list = [symbol, timeframe.value]
        if start_ts is not None:
            sql += " AND timestamp >= ?"
            params.append(start_ts)
        if end_ts is not None:
            sql += " AND timestamp <= ?"
            params.append(end_ts)
        sql += " ORDER BY timestamp ASC"
        cursor = conn.execute(sql, params)
        columns = [desc[0] for desc in cursor.description]
        rows = cursor.fetchall()
        return [
            Bar(
                symbol=row[columns.index("symbol")],
                timeframe=TimeFrame(row[columns.index("timeframe")]),
                timestamp=row[columns.index("timestamp")],
                open=row[columns.index("open")],
                high=row[columns.index("high")],
                low=row[columns.index("low")],
                close=row[columns.index("close")],
                volume=row[columns.index("volume")],
            )
            for row in rows
        ]
    finally:
        conn.close()
```

- [ ] **Step 5: 重新运行测试确认通过**

Run: `cd packages/data-client && python -m pytest tests/test_client.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/data-client/
git commit -m "fix: data-client use column name mapping instead of index for schema alignment"
```

---

## Task 4: 创建数据采集脚本

**Files:**
- Create: `scripts/seed-data.ts`

这个脚本用 data-collector 的 AKShare 适配器拉取真实 A 股日线数据，写入 data-center 的 SQLite。

- [ ] **Step 1: 编写数据采集脚本**

```typescript
// scripts/seed-data.ts
/**
 * 数据采集脚本 — 用 AKShare 拉取真实 A 股行情写入 data-center
 *
 * 用法: npx tsx scripts/seed-data.ts
 *
 * 默认拉取：
 * - 贵州茅台(600519) 日K线 2023-01-01 ~ 2024-12-31
 * - 沪深300成分股列表
 */
import { createDataCenter } from "@quant/data-center";
import { createCollector } from "@quant/data-collector";
import { CollectorPresets, CollectorDomain } from "@quant/data-collector";
import { TimeFrame } from "@quant/data-center";

const DB_PATH = "data/quant.db";
const SYMBOLS = ["600519"]; // 贵州茅台
const START_DATE = new Date("2023-01-01").getTime();
const END_DATE = new Date("2024-12-31").getTime();

async function main(): Promise<void> {
  console.log("=== 数据采集开始 ===\n");

  // 1. 创建数据中心
  const dc = await createDataCenter({ dbPath: DB_PATH, persistence: "immediate" });
  console.log(`数据中心已创建: ${DB_PATH}`);

  // 2. 创建采集器
  const { registry, scheduler } = createCollector({ sources: ["akshare"] });
  // 注入数据中心 RepositorySet
  const schedulerWithRepos = new (await import("@quant/data-collector")).CollectorScheduler(registry, dc.repos);

  // 3. 采集标的列表
  console.log("\n--- 采集标的列表 ---");
  const instrumentTask = CollectorPresets.instruments("akshare");
  try {
    const results = await schedulerWithRepos.execute(instrumentTask);
    for (const r of results) {
      console.log(`  标的列表: 写入 ${r.recordsWritten} 条, 耗时 ${r.duration}ms`);
    }
  } catch (err) {
    console.warn(`  标的列表采集失败（非阻塞）: ${err}`);
  }

  // 4. 采集日K线
  for (const symbol of SYMBOLS) {
    console.log(`\n--- 采集 ${symbol} 日K线 ---`);
    const barTask = CollectorPresets.dailyBar(symbol, "akshare", {
      start: START_DATE,
      end: END_DATE,
    });
    try {
      const results = await schedulerWithRepos.execute(barTask);
      for (const r of results) {
        console.log(`  ${symbol}: 写入 ${r.recordsWritten} 条, 最后时间戳 ${r.lastTimestamp}, 耗时 ${r.duration}ms`);
      }
    } catch (err) {
      console.error(`  ${symbol} 日K线采集失败: ${err}`);
    }
  }

  // 5. 关闭数据中心
  await dc.close();
  console.log("\n=== 数据采集完成，数据库已保存 ===");
}

main().catch((err) => {
  console.error(`数据采集失败: ${err}`);
  process.exit(1);
});
```

- [ ] **Step 2: 确认 data-collector 导出 CollectorScheduler**

检查 `services/data-collector/src/index.ts` 是否导出了 `CollectorScheduler`。如果没有，添加导出。

- [ ] **Step 3: 运行数据采集脚本**

Run: `npx tsx scripts/seed-data.ts`
Expected: 输出采集进度，最终 `数据采集完成，数据库已保存`

- [ ] **Step 4: 验证数据库内容**

```typescript
// 临时验证脚本（内联执行）
import { createDataCenter } from "@quant/data-center";
import { TimeFrame } from "@quant/data-center";

const dc = await createDataCenter({ dbPath: "data/quant.db" });
const bars = await dc.providers.market.loadBars("600519", TimeFrame.D1);
console.log(`600519 日K线条数: ${bars.length}`);
if (bars.length > 0) {
  console.log(`第一条: ${JSON.stringify(bars[0])}`);
  console.log(`最后一条: ${JSON.stringify(bars[bars.length - 1])}`);
}
await dc.close();
```

Expected: bars.length > 0，数据包含 open/high/low/close/volume

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-data.ts
git commit -m "feat: add seed-data script for AKShare data ingestion"
```

---

## Task 5: 端到端回测验证 — Python CLI 直接调用

**Files:**
- Create: `scripts/run-backtest.ts`

在 Task 4 采集到真实数据后，直接用 Python CLI 跑一次完整回测，验证 Python 侧全链路。

- [ ] **Step 1: 安装所有 Python 包**

Run: `cd packages/strategy-runtime && pip install -e . && cd ../backtest-engine && pip install -e . && cd ../data-client && pip install -e . && cd ../strategies && pip install -e .`
Expected: 所有包安装成功

- [ ] **Step 2: 用 Python CLI 直接测试回测**

```bash
echo '{"command":"backtest","strategy":"dual_ma","config":{"initialCash":1000000,"slippage":0.001},"dataRange":{"dbPath":"data/quant.db","symbol":"600519","timeframe":"1d"}}' | python -m quantforge_strategy.cli
```

Expected: 输出 JSON `{"ok": true, "data": {"config": {...}, "trades": [...], "equity_curve": [...], "metrics": {...}}}`

- [ ] **Step 3: 如果失败，根据错误信息修复**

常见问题：
- `ModuleNotFoundError`: 某个包未安装 → `pip install -e .`
- `NO_DATA`: DataClient 找不到数据 → 检查 dbPath 和 schema 列名
- `KeyError`: 列名映射不对 → 修复 Task 3

- [ ] **Step 4: 编写端到端回测验证脚本**

```typescript
// scripts/run-backtest.ts
/**
 * 端到端回测验证脚本 — 通过 Worker PythonBridge 调用 Python CLI
 *
 * 用法: npx tsx scripts/run-backtest.ts
 *
 * 前置条件: 已运行 seed-data.ts 采集数据
 */
import { PythonBridge } from "@quant/worker";

async function main(): Promise<void> {
  console.log("=== 端到端回测验证 ===\n");

  const bridge = new PythonBridge({ timeout: 120_000 });

  // 1. 双均线策略回测
  console.log("--- 双均线策略回测 ---");
  const result = await bridge.call({
    command: "backtest",
    strategy: "dual_ma",
    config: { initialCash: 1000000, slippage: 0.001 },
    dataRange: {
      dbPath: "data/quant.db",
      symbol: "600519",
      timeframe: "1d",
    },
  });

  if (result.ok && result.data) {
    const data = result.data as any;
    console.log(`策略: ${data.config?.strategy_name ?? "dual_ma"}`);
    console.log(`初始资金: ${data.config?.initial_cash}`);
    console.log(`交易次数: ${data.trades?.length ?? 0}`);
    console.log(`权益曲线点数: ${data.equity_curve?.length ?? 0}`);
    const metrics = data.metrics;
    if (metrics) {
      console.log(`\n--- 回测指标 ---`);
      console.log(`总收益率: ${((metrics.total_return ?? 0) * 100).toFixed(2)}%`);
      console.log(`年化收益率: ${((metrics.annualized_return ?? 0) * 100).toFixed(2)}%`);
      console.log(`最大回撤: ${((metrics.max_drawdown ?? 0) * 100).toFixed(2)}%`);
      console.log(`夏普比率: ${metrics.sharpe_ratio ?? "N/A"}`);
      console.log(`胜率: ${((metrics.win_rate ?? 0) * 100).toFixed(2)}%`);
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
```

- [ ] **Step 5: 运行端到端回测脚本**

Run: `npx tsx scripts/run-backtest.ts`
Expected: 输出回测指标，`端到端回测验证通过`

- [ ] **Step 6: Commit**

```bash
git add scripts/run-backtest.ts
git commit -m "feat: add e2e backtest verification script"
```

---

## Task 6: 编写端到端集成测试

> **状态: ✅ 已完成**
> - 创建 `apps/worker/tests/e2e-pipeline.test.ts`
> - 4/4 测试通过：正常回测、错误策略、无效标的、无效命令

**Files:**
- Create: `tests/e2e-backtest.test.ts`

将 Task 5 的验证流程固化为自动化测试，确保后续修改不会破坏端到端链路。

- [ ] **Step 1: 编写端到端集成测试**

```typescript
// tests/e2e-backtest.test.ts
/**
 * 端到端集成测试 — 验证 data-collector → data-center → Python CLI 回测全链路
 *
 * 使用 CSV 适配器（无需 AKShare 环境），验证数据流和回测逻辑正确性。
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createDataCenter, TimeFrame } from "@quant/data-center";
import { createCollector, CollectorPresets, CollectorDomain, CollectorScheduler } from "@quant/data-collector";
import { CsvAdapter } from "@quant/data-collector";
import { PythonBridge } from "@quant/worker";
import type { DataCenter } from "@quant/data-center";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const exec = promisify(execFile);

// 测试用 CSV 数据 — 20 个交易日的模拟行情
const TEST_CSV = `symbol,timestamp,open,high,low,close,volume,turnover
TEST001,1700000000000,100.0,102.0,99.0,101.0,10000,1010000
TEST001,1700086400000,101.0,103.0,100.0,102.5,11000,1127500
TEST001,1700172800000,102.5,105.0,102.0,104.0,12000,1248000
TEST001,1700259200000,104.0,106.0,103.0,105.5,13000,1371500
TEST001,1700345600000,105.5,107.0,104.5,106.0,11500,1219000
TEST001,1700432000000,106.0,108.0,105.0,107.5,12500,1343750
TEST001,1700518400000,107.5,109.0,106.5,108.0,14000,1512000
TEST001,1700604800000,108.0,110.0,107.0,109.5,15000,1642500
TEST001,1700691200000,109.5,111.0,108.5,110.0,13500,1485000
TEST001,1700777600000,110.0,112.0,109.0,111.5,16000,1784000
TEST001,1700864000000,111.5,113.0,110.5,112.0,14500,1624000
TEST001,1700950400000,112.0,114.0,111.0,113.5,17000,1929500
TEST001,1701036800000,113.5,115.0,112.5,114.0,15500,1767000
TEST001,1701123200000,114.0,116.0,113.0,115.5,18000,2079000
TEST001,1701209600000,115.5,117.0,114.5,116.0,16500,1914000
TEST001,1701296000000,116.0,118.0,115.0,117.5,19000,2232500
TEST001,1701382400000,117.5,119.0,116.5,118.0,17500,2065000
TEST001,1701468800000,118.0,120.0,117.0,119.5,20000,2390000
TEST001,1701555200000,119.5,121.0,118.5,120.0,18500,2220000
TEST001,1701641600000,120.0,122.0,119.0,121.5,21000,2551500`;

const TEST_DB = join(process.cwd(), "data", "e2e-test.db");

describe("端到端集成测试", () => {
  let dc: DataCenter;

  beforeAll(async () => {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    dc = await createDataCenter({ dbPath: TEST_DB, persistence: "immediate" });
  });

  afterAll(async () => {
    await dc.close();
  });

  it("CSV → data-center 写入 → 查询验证", async () => {
    const { registry } = createCollector({ sources: ["csv"] });
    const scheduler = new CollectorScheduler(registry, dc.repos);

    const task = CollectorPresets.dailyBar("TEST001", "csv");
    const results = await scheduler.execute(task, { csvContent: TEST_CSV });

    expect(results).toHaveLength(1);
    expect(results[0].recordsWritten).toBe(20);
    expect(results[0].symbol).toBe("TEST001");

    // 通过 Provider 查询验证
    const bars = await dc.providers.market.loadBars("TEST001", TimeFrame.D1);
    expect(bars.length).toBe(20);
    expect(bars[0].close).toBe(101.0);
    expect(bars[bars.length - 1].close).toBe(121.5);
  });

  it("Python CLI 回测 — 双均线策略", async () => {
    // 先确认 Python 包已安装
    try {
      await exec("python", ["-c", "import quantforge_strategy; import quantforge_backtest; import quantforge_data; import quantforge_strategies"]);
    } catch {
      // Python 包未安装，跳过此测试
      console.warn("Python 包未安装，跳过 CLI 回测测试");
      return;
    }

    const bridge = new PythonBridge({ timeout: 60_000 });
    const result = await bridge.call({
      command: "backtest",
      strategy: "dual_ma",
      config: { initialCash: 1000000, slippage: 0.001 },
      dataRange: {
        dbPath: TEST_DB,
        symbol: "TEST001",
        timeframe: "1d",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    const data = result.data as any;
    expect(data.config).toBeDefined();
    expect(data.trades).toBeDefined();
    expect(data.equity_curve).toBeDefined();
    expect(data.metrics).toBeDefined();
    expect(data.equity_curve.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 运行端到端集成测试**

Run: `npx vitest run tests/e2e-backtest.test.ts`
Expected: 两个测试都通过

- [ ] **Step 3: Commit**

```bash
git add tests/e2e-backtest.test.ts
git commit -m "test: add e2e integration test for data-collector to backtest pipeline"
```

---

## Task 7: 全量验证 + 文档更新

**Files:**
- Modify: `README.md`
- Modify: `AGENT.md`

- [ ] **Step 1: 运行全量 TS 测试**

Run: `pnpm test`
Expected: 全部通过

- [ ] **Step 2: 运行全量 Python 测试**

Run: `cd packages/strategy-runtime && python -m pytest && cd ../backtest-engine && python -m pytest && cd ../data-client && python -m pytest && cd ../strategies && python -m pytest && cd ../factor-lab && python -m pytest && cd ../ai-engine && python -m pytest`
Expected: 全部通过

- [ ] **Step 3: 运行 Lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 4: 运行 Build**

Run: `pnpm build`
Expected: 成功

- [ ] **Step 5: 密钥扫描 — 确认无硬编码 token**

Run: `grep -r "api_key\|apikey\|secret_key\|token.*=" --include="*.ts" --include="*.py" services/ packages/ apps/ scripts/ || echo "无硬编码密钥"`
Expected: 无硬编码密钥

- [ ] **Step 6: 更新 README.md**

在"当前还没做"部分移除"真实数据源接入"，在"已完成"部分添加：

```text
- 真实数据源接入（AKShare A 股日线行情，data-collector → data-center 完整链路已验证）
- 端到端回测验证（Worker → Python CLI → 回测引擎 → BacktestResult 全链路已跑通）
```

在"后续规划"中移除第 14 项"services/data-collector 真实数据源接入"。

- [ ] **Step 7: 更新 AGENT.md**

在"当前阶段"中添加真实数据接入和端到端验证的描述。

- [ ] **Step 8: Commit**

```bash
git add README.md AGENT.md
git commit -m "docs: update project status — real data ingestion and e2e backtest verified"
```

---

## 验收标准

完成所有 Task 后，以下条件必须全部满足：

1. `pnpm lint` — 0 错误
2. `pnpm test` — 全部通过
3. `pnpm build` — 成功
4. `python -m pytest`（各 Python 包）— 全部通过
5. `npx tsx scripts/seed-data.ts` — 能拉取 600519 日K线并写入 SQLite
6. `npx tsx scripts/run-backtest.ts` — 双均线策略回测输出完整指标
7. 无硬编码密钥
8. README.md 和 AGENT.md 已更新

验收通过后，策略开发可以正式启动：开发者只需在 `packages/strategies` 中继承 `Strategy` ABC，即可通过 CLI 或 Worker 触发回测。
