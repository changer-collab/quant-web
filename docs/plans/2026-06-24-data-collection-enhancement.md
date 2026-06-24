# 真实策略端到端验证 — 增强方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 `2026-06-24-real-strategy-e2e.md` 基础上，增强数据采集能力（新增 mootdx + 腾讯适配器），补充财务/估值数据，解决 data/ 目录 gitignore 问题，使 e2e 验证有更丰富的数据支撑。

**Architecture:** 新增两个数据源适配器（mootdx TCP 行情 + 腾讯 HTTP 估值），扩展 seed-data 脚本采集财务报告和估值数据，调整 gitignore 策略。不改动 data-center 存储层，不改动上层业务。

**Tech Stack:** Python (mootdx, requests), TypeScript (data-collector adapters)

---

## 现有计划评估

### 优点
1. 分四阶段递进验证，每阶段独立可验证
2. 从 Python CLI 直接调用到 Worker+API 全链路，覆盖完整
3. 每个 Task 都有明确的验证命令和预期输出
4. 策略对比脚本（Task 2.2 Step 5）很实用

### 需要补充的问题
1. **数据维度单一**：seed-data 只采集了日K线，缺少财务报告、估值数据、复权因子，限制了策略类型（如基本面策略无法验证）
2. **数据源可靠性**：baostock 偶尔不稳定，缺少备用数据源
3. **data/ gitignore 冲突**：quant.db 约 5-10MB，不适合提交 git，但本地验证需要它存在
4. **缺少实时行情能力**：mootdx 提供可靠的 TCP 行情，不封 IP，可作为 K 线采集的替代/补充
5. **估值数据缺失**：没有 PE/PB/市值等估值数据，前端展示的估值分析模块无法验证

---

## 增强内容：数据采集扩展

### 设计原则（严格遵循 AGENTS.md 边界）

```text
新增的适配器放在 services/data-collector/src/adapters/
数据写入通过 data-center 的 Repository 接口
不新增 Repository（现有 schema 已覆盖 valuation、financial_report 等表）
不改动 data-center 的 Provider 层
不改动上层 API/Worker/前端
```

### 新增适配器清单

| 适配器 | 数据源 | 协议 | 数据类型 | 参考来源 |
|--------|--------|------|----------|----------|
| MootdxAdapter | 通达信行情 | TCP 7709 | bar, instrument | a-stock-data mootdx 层 |
| TencentAdapter | 腾讯财经 | HTTP | valuation (PE/PB/市值) | a-stock-data 腾讯层 |

**不新增的适配器**（超出当前阶段需求）：
- 东财数据中心适配器（龙虎榜、融资融券、大宗交易）— 策略验证不需要
- 同花顺适配器（热点、北向）— 信号层数据，不是策略输入
- 巨潮公告适配器 — 非回测必需

---

## Task 1: 新增 MootdxAdapter

**Files:**
- Create: `services/data-collector/src/adapters/mootdx-adapter.ts`
- Modify: `services/data-collector/src/adapters/types.ts` (新增 MootdxExtra)
- Modify: `services/data-collector/src/adapters/index.ts` (导出)
- Modify: `services/data-collector/src/bootstrap.ts` (注册)
- Modify: `services/data-collector/src/source-selector.ts` (优先级)
- Test: `services/data-collector/src/adapters/__tests__/mootdx-adapter.test.ts`

### Task 1.1: 定义 MootdxExtra 类型

- [ ] **Step 1: 在 types.ts 新增 MootdxExtra**

在 `services/data-collector/src/adapters/types.ts` 的 `YfinanceExtra` 定义之后添加：

```typescript
/** Mootdx 适配器额外参数 */
export interface MootdxExtra {
  /** Python 可执行文件路径，默认 python */
  pythonPath?: string;
  /** 通达信服务器 IP（可选，自动探测） */
  server?: string;
  /** 通达信服务器端口，默认 7709 */
  port?: number;
}
```

在 `AdapterExtra` 联合类型中加入 `MootdxExtra`。

- [ ] **Step 2: Commit**

```bash
git add services/data-collector/src/adapters/types.ts
git commit -m "feat(data-collector): add MootdxExtra type for mootdx adapter"
```

---

### Task 1.2: 实现 MootdxAdapter

**参考 a-stock-data 的 mootdx 用法：**
- TCP 连通达信服务器（7709 端口）
- `Quotes.factory(market='std')` 获取行情客户端
- `client.bars(symbol, category=4, offset=N)` 获取 K 线
- category: 4=日线, 5=周线, 6=月线, 7=1分钟, 8=5分钟, 9=15分钟, 10=30分钟, 11=60分钟
- 返回字段: open, close, high, low, vol, amount, datetime

**参考 a-stock-data 的 tdx_client() fallback 逻辑（V3.2.4）：**
- TCP 探测内置可用服务器列表
- 三级 fallback：bestip 测速 → 裸 factory → 明确报错
- 兼容 mootdx 0.10/0.11

- [ ] **Step 1: 创建 mootdx-adapter.ts**

```typescript
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DataSourceAdapter, RawDataRecord, AdapterFetchOptions, MootdxExtra } from './types.js';

const execFileAsync = promisify(execFile);

/**
 * Mootdx 适配器 — 通过 Python 子进程调用 mootdx（通达信行情）
 *
 * mootdx 走 TCP 直连通达信行情服务器（7709），不封 IP。
 * 提供日K线、周K线、月K线、分钟K线等数据。
 *
 * 参考: https://github.com/simonlin1212/a-stock-data (mootdx 层)
 *
 * 依赖：
 * - Python 3.8+ 且已安装 mootdx（pip install mootdx）
 * - 可通过 extra.pythonPath 指定 Python 路径
 */
export class MootdxAdapter implements DataSourceAdapter {
  name = 'mootdx';
  supportedDomains = ['market'];
  supportedDataTypes = ['bar'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as MootdxExtra | undefined;
    const pythonPath = extra?.pythonPath ?? 'python';
    const script = this.buildScript(options);

    const { stdout } = await execFileAsync(pythonPath, ['-c', script], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 120_000,
    });

    if (!stdout.trim()) return;

    const records: RawDataRecord[] = JSON.parse(stdout);
    for (const record of records) {
      yield record;
    }
  }

  private buildScript(options: AdapterFetchOptions): string {
    const { symbol, timeframe } = options;
    const extra = options.extra as MootdxExtra | undefined;

    // timeframe → mootdx category 映射
    const categoryMap: Record<string, number> = {
      '1d': 4,
      '1w': 5,
      '1M': 6,
      '1m': 7,
      '5m': 8,
      '15m': 9,
      '30m': 10,
      '60m': 11,
    };
    const category = categoryMap[timeframe ?? '1d'] ?? 4;

    // mootdx market: 0=深圳, 1=上海
    const market = symbol.startsWith('6') || symbol.startsWith('9') ? 1 : 0;
    // mootdx symbol 不带前缀，纯 6 位
    const code = symbol.replace(/^(sh|sz|SH|SZ)/, '');

    // 计算需要拉取的 K 线数量（约 2 年日K ≈ 500 条）
    const offset = 500;

    // 服务器配置
    const serverArg = extra?.server
      ? `server=("${extra.server}", ${extra.port ?? 7709})`
      : '';

    return `
import json, sys, os

_real_stdout = sys.stdout
sys.stdout = open(os.devnull, 'w')

try:
    from mootdx.quotes import Quotes
    ${extra?.server
      ? `client = Quotes.factory(market='std', server=("${extra.server}", ${extra.port ?? 7709}))`
      : `client = Quotes.factory(market='std')`
    }
except Exception:
    sys.stdout = _real_stdout
    print(json.dumps([]))
    sys.exit(0)

sys.stdout = _real_stdout

try:
    klines = client.bars(symbol='${code}', category=${category}, offset=${offset})
    if klines is None or len(klines) == 0:
        print(json.dumps([]))
    else:
        rows = []
        for _, row in klines.iterrows():
            ts = int(str(row['datetime']).replace('-', '')[:8])
            # YYYYMMDD → 毫秒时间戳
            from datetime import datetime
            dt = datetime.strptime(str(ts), '%Y%m%d')
            ms = int(dt.timestamp() * 1000)
            rows.append({
                'symbol': '${symbol}',
                'timeframe': '${timeframe ?? '1d'}',
                'timestamp': ms,
                'open': float(row['open']),
                'high': float(row['high']),
                'low': float(row['low']),
                'close': float(row['close']),
                'volume': float(row['vol']),
                'turnover': float(row['amount']),
            })
        print(json.dumps(rows, default=str))
except Exception as e:
    sys.stdout = _real_stdout
    print(json.dumps([]), file=sys.stderr)
    print(json.dumps([]))
`;
  }
}
```

- [ ] **Step 2: 在 adapters/index.ts 添加导出**

在 `adapters/index.ts` 中添加：

```typescript
export { MootdxAdapter } from './mootdx-adapter.js';
```

并在 `AdapterExtra` 类型导出中加入 `MootdxExtra`。

- [ ] **Step 3: 在 bootstrap.ts 注册 MootdxAdapter**

在 `bootstrap.ts` 的 switch 语句中添加：

```typescript
case 'mootdx':
  registry.register(new MootdxAdapter());
  break;
```

在 `CollectorBootstrapConfig.sources` 类型中加入 `'mootdx'`。

- [ ] **Step 4: 在 source-selector.ts 更新优先级**

更新 `SOURCE_PRIORITY` 中 bar 的优先级：

```typescript
bar: ['mootdx', 'akshare', 'baostock', 'efinance', 'yfinance', 'tushare'],
```

mootdx 排第一，因为它走 TCP 不封 IP，比 baostock 更可靠。

- [ ] **Step 5: 安装 mootdx**

Run: `pip install mootdx`
Expected: Successfully installed mootdx-x.x.x

- [ ] **Step 6: 验证 mootdx 可用**

Run: `python -c "from mootdx.quotes import Quotes; print('ok')"`
Expected: 输出 `ok`

- [ ] **Step 7: Commit**

```bash
git add services/data-collector/src/adapters/mootdx-adapter.ts services/data-collector/src/adapters/types.ts services/data-collector/src/adapters/index.ts services/data-collector/src/bootstrap.ts services/data-collector/src/source-selector.ts
git commit -m "feat(data-collector): add MootdxAdapter for reliable K-line collection via TCP"
```

---

## Task 2: 新增 TencentAdapter（估值数据）

**Files:**
- Create: `services/data-collector/src/adapters/tencent-adapter.ts`
- Modify: `services/data-collector/src/adapters/types.ts` (新增 TencentExtra)
- Modify: `services/data-collector/src/adapters/index.ts` (导出)
- Modify: `services/data-collector/src/bootstrap.ts` (注册)
- Modify: `services/data-collector/src/scheduler.ts` (写入 valuation)

### Task 2.1: 定义 TencentExtra 类型

- [ ] **Step 1: 在 types.ts 新增 TencentExtra**

在 `MootdxExtra` 定义之后添加：

```typescript
/** 腾讯财经适配器额外参数 */
export interface TencentExtra {
  /** 请求超时毫秒，默认 10000 */
  timeout?: number;
}
```

在 `AdapterExtra` 联合类型中加入 `TencentExtra`。

- [ ] **Step 2: Commit**

```bash
git add services/data-collector/src/adapters/types.ts
git commit -m "feat(data-collector): add TencentExtra type"
```

---

### Task 2.2: 实现 TencentAdapter

**参考 a-stock-data 的腾讯财经用法：**
- HTTP GET `https://qt.gtimg.cn/q=sh600519`
- GBK 编码，`~` 分隔 88 个字段
- 索引 39 = PE(TTM), 46 = PB, 44 = 总市值(亿), 45 = 流通市值(亿)
- 不封 IP，免费无 key

- [ ] **Step 1: 创建 tencent-adapter.ts**

```typescript
import type { DataSourceAdapter, RawDataRecord, AdapterFetchOptions, TencentExtra } from './types.js';

/**
 * 腾讯财经适配器 — 通过 HTTP 拉取实时估值数据
 *
 * 腾讯财经 API 不封 IP，免费无 key。
 * 提供 PE(TTM)、PB、总市值、流通市值、换手率等估值数据。
 *
 * 参考: https://github.com/simonlin1212/a-stock-data (腾讯财经层)
 *
 * 字段索引（实测校准）：
 * - 39: PE(TTM)
 * - 44: 总市值(亿)
 * - 45: 流通市值(亿)
 * - 46: PB(市净率)
 * - 38: 换手率%
 * - 32: 涨跌幅%
 * - 47: 涨停价
 * - 48: 跌停价
 */
export class TencentAdapter implements DataSourceAdapter {
  name = 'tencent';
  supportedDomains = ['fundamental'];
  supportedDataTypes = ['valuation'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const { symbol } = options;
    const extra = options.extra as TencentExtra | undefined;
    const timeout = extra?.timeout ?? 10_000;

    // 6位代码 → 市场前缀
    const prefix = symbol.startsWith('6') || symbol.startsWith('9') ? 'sh'
      : symbol.startsWith('8') ? 'bj'
      : 'sz';
    const code = symbol.replace(/^(sh|sz|SH|SZ|bj|BJ)/, '');

    const url = `https://qt.gtimg.cn/q=${prefix}${code}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      });
      const buffer = await response.arrayBuffer();
      // GBK 解码
      const decoder = new TextDecoder('gbk');
      const text = decoder.decode(buffer);

      const records = this.parseResponse(text, symbol);
      for (const record of records) {
        yield record;
      }
    } catch (err) {
      console.error(`腾讯财经 ${symbol} 拉取失败:`, err);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseResponse(text: string, symbol: string): RawDataRecord[] {
    const records: RawDataRecord[] = [];

    for (const line of text.trim().split(';')) {
      if (!line.trim() || !line.includes('=') || !line.includes('"')) continue;

      const vals = line.split('"')[1]?.split('~');
      if (!vals || vals.length < 53) continue;

      const peTtm = parseFloat(vals[39]);
      const pb = parseFloat(vals[46]);
      const marketCap = parseFloat(vals[44]);
      const floatMarketCap = parseFloat(vals[45]);

      // 至少有一个有效估值数据才写入
      if (isNaN(peTtm) && isNaN(pb) && isNaN(marketCap)) continue;

      const now = Date.now();
      records.push({
        symbol,
        timestamp: now,
        pe: isNaN(peTtm) ? null : peTtm,
        peTtm: isNaN(peTtm) ? null : peTtm,
        pb: isNaN(pb) ? null : pb,
        ps: null,
        psTtm: null,
        marketCap: isNaN(marketCap) ? 0 : marketCap * 1e8, // 亿 → 元
        dividendYield: null,
        turnoverRate: parseFloat(vals[38]) || null,
        floatShares: isNaN(floatMarketCap) ? null : floatMarketCap * 1e8,
      });
    }

    return records;
  }
}
```

- [ ] **Step 2: 在 adapters/index.ts 添加导出**

```typescript
export { TencentAdapter } from './tencent-adapter.js';
```

在类型导出中加入 `TencentExtra`。

- [ ] **Step 3: 在 bootstrap.ts 注册 TencentAdapter**

```typescript
case 'tencent':
  registry.register(new TencentAdapter());
  break;
```

在 `CollectorBootstrapConfig.sources` 类型中加入 `'tencent'`。

- [ ] **Step 4: 在 scheduler.ts 的 writeToDataCenter 中确认 valuation 写入**

检查 `scheduler.ts` 的 `writeToDataCenter` 方法，确保 `case 'valuation'` 分支已存在（当前代码已支持 `this.repos.valuations.save(rawRecords as any)`）。无需修改。

- [ ] **Step 5: 验证腾讯 API 可用**

Run: `python -c "import urllib.request; r = urllib.request.urlopen('https://qt.gtimg.cn/q=sh600519', timeout=10); print(r.read().decode('gbk')[:200])"`
Expected: 输出包含 `~贵州茅台~600519~` 的行情数据

- [ ] **Step 6: Commit**

```bash
git add services/data-collector/src/adapters/tencent-adapter.ts services/data-collector/src/adapters/types.ts services/data-collector/src/adapters/index.ts services/data-collector/src/bootstrap.ts
git commit -m "feat(data-collector): add TencentAdapter for PE/PB/market cap valuation data"
```

---

## Task 3: 扩展 seed-data 脚本

**Files:**
- Modify: `scripts/seed-data.ts`

### Task 3.1: 增强 seed-data 采集维度

- [ ] **Step 1: 更新 seed-data.ts**

在现有日K线采集之后，追加以下采集：

```typescript
// === 新增：复权因子采集 ===
console.log("\n--- 采集复权因子 ---");
for (const symbol of SYMBOLS) {
  const adjTask = CollectorPresets.adjustmentFactor(symbol, 'baostock', {
    start: START_DATE,
    end: END_DATE,
  });
  try {
    const results = await scheduler.execute(adjTask);
    for (const r of results) {
      console.log(`  ${symbol} 复权因子: 写入 ${r.recordsWritten} 条`);
    }
  } catch (err) {
    console.warn(`  ${symbol} 复权因子采集失败（非阻塞）: ${err}`);
  }
}

// === 新增：财务报告采集 ===
console.log("\n--- 采集财务报告 ---");
for (const symbol of SYMBOLS) {
  const finTask = CollectorPresets.financialReport(symbol, 'baostock', {
    start: START_DATE,
    end: END_DATE,
  });
  try {
    const results = await scheduler.execute(finTask);
    for (const r of results) {
      console.log(`  ${symbol} 财务报告: 写入 ${r.recordsWritten} 条`);
    }
  } catch (err) {
    console.warn(`  ${symbol} 财务报告采集失败（非阻塞）: ${err}`);
  }
}

// === 新增：估值数据采集（腾讯） ===
console.log("\n--- 采集估值数据（腾讯） ---");
for (const symbol of SYMBOLS) {
  const valTask = CollectorPresets.valuation(symbol, 'tencent');
  try {
    const results = await scheduler.execute(valTask);
    for (const r of results) {
      console.log(`  ${symbol} 估值: 写入 ${r.recordsWritten} 条`);
    }
  } catch (err) {
    console.warn(`  ${symbol} 估值采集失败（非阻塞）: ${err}`);
  }
}
```

同时更新 `createCollector` 调用，加入 mootdx 和 tencent：

```typescript
const { registry } = createCollector({ sources: ['baostock', 'mootdx', 'tencent'] });
```

- [ ] **Step 2: Commit**

```bash
git add scripts/seed-data.ts
git commit -m "feat(scripts): enhance seed-data with adjustment factors, financial reports, and valuation data"
```

---

## Task 4: 解决 data/ gitignore 问题

**Files:**
- Modify: `.gitignore`
- Create: `.gitkeep` in `data/`
- Create: `scripts/README-data.md`（仅在用户明确要求时）

### 问题分析

- `data/quant.db` 约 5-10MB，不适合提交 git
- 但本地验证需要 `data/` 目录存在
- `data/` 被 gitignore 后，新 clone 的开发者不知道需要 seed 数据

### 方案

- [ ] **Step 1: 修改 .gitignore**

将 `data/` 改为只忽略数据库文件，保留目录结构：

```gitignore
# local data (SQLite, CSV, etc.)
data/*.db
data/*.db-journal
data/*.db-wal
data/*.csv
```

这样 `data/` 目录本身可以被 git 跟踪（通过 .gitkeep），但数据库文件不会被提交。

- [ ] **Step 2: 创建 data/.gitkeep**

```bash
# 确保 data/ 目录存在且可被 git 跟踪
touch data/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore data/.gitkeep
git commit -m "chore: keep data/ directory in git while ignoring db files"
```

---

## Task 5: 更新计划文档

**Files:**
- Modify: `docs/plans/2026-06-24-real-strategy-e2e.md`

### Task 5.1: 将增强内容整合到原计划

- [ ] **Step 1: 更新 Phase 1 的 Task 1.1**

在原计划的 Task 1.1 之前插入 Task 1.0（安装 mootdx + 验证），并将 seed-data 的预期输出更新为包含复权因子、财务报告和估值数据。

在原计划的 `## 注意事项` 部分追加：

```markdown
6. mootdx 走 TCP 直连通达信服务器，需要国内网络。海外环境可跳过 mootdx 相关步骤，baostock 作为 fallback。
7. 腾讯估值数据是实时快照（当前时刻），不是历史序列。如需历史估值，需定期采集积累。
8. seed-data 新增了复权因子、财务报告和估值数据采集，总耗时约 3-5 分钟（取决于网络）。
9. data/ 目录已通过 .gitkeep 保留，数据库文件通过 .gitignore 排除。新开发者需运行 seed-data 获取本地数据。
```

- [ ] **Step 2: Commit**

```bash
git add docs/plans/2026-06-24-real-strategy-e2e.md
git commit -m "docs: update e2e plan with enhanced data collection and mootdx/tencent adapters"
```

---

## 实现顺序

```text
Task 4（gitignore 修复，无依赖）:
  Step 1-3

Task 1（MootdxAdapter，无依赖）:
  Step 1-7

Task 2（TencentAdapter，依赖 Task 1.1 types）:
  Step 1-6

Task 3（seed-data 扩展，依赖 Task 1 + Task 2）:
  Step 1-2

Task 5（文档更新，依赖 Task 1-4）:
  Step 1-2
```

## 边界约束检查

| 约束 | 检查结果 |
|------|----------|
| data-collector 不存储数据 | ✅ 适配器只返回 RawDataRecord，写入由 scheduler 通过 repos 完成 |
| data-collector 不提供查询接口 | ✅ 新增适配器不涉及查询 |
| data-collector 不感知上层业务 | ✅ 适配器不知道回测/策略逻辑 |
| data-collector 依赖 data-center | ✅ 通过 RepositorySet 写入，类型从 data-center 获取 |
| valuation 数据已有 schema 和 repo | ✅ schema.ts 中 valuations 表已存在，SqliteValuationRepository 已实现 |
| financial_report 数据已有 schema 和 repo | ✅ schema.ts 中 financial_reports 表已存在 |
| adjustment_factor 数据已有 schema 和 repo | ✅ schema.ts 中 adjustment_factors 表已存在 |
| 不新增 Repository | ✅ 所有数据类型复用现有存储 |
| 不改动 data-center Provider | ✅ Provider 层零改动 |
| 不改动上层 API/Worker/前端 | ✅ 上层零改动 |
