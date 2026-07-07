# 数据源增强 & Parquet 导入决策方案

> 创建时间：2026-07-06（Asia/Shanghai）
> 最后更新：2026-07-07（Phase 1 + P1 全部完成）
> 任务来源：用户要求借鉴 `https://github.com/simonlin1212/a-stock-data` + 把 `E:\quant-data` 回测数据入库
> 约束：先做 3 星 + 2 星优先级（保留 1 星）；先做 Phase 1（保留 Phase 2/3 空间）

---

## 零、当前进度（2026-07-07 同步）

### Phase 1 + P1 全部完成 ✅

| 任务 | 文件 | 验证 |
|------|------|------|
| P0-A: mootdx tdx_client 三级 fallback | [mootdx-adapter.ts](file:///d:/quant-web/services/data-collector/src/adapters/mootdx-adapter.ts) | 58 测试通过 |
| P0-B: em-client.ts 东财限流基础设施 | [em-client.ts](file:///d:/quant-web/services/data-collector/src/adapters/eastmoney/em-client.ts) | 7 测试通过 |
| 阶段1-1: TimeFrame 枚举扩展（W1/Mo1/Q1/Y1） | [types.ts](file:///d:/quant-web/services/data-center/src/base/types.ts) | 编译通过 |
| 阶段1-2: ParquetAdapter（Python+pyarrow） | [parquet-adapter.ts](file:///d:/quant-web/services/data-collector/src/adapters/parquet-adapter.ts) | 4 单元测试通过 |
| 阶段1-3: import-parquet 命令 | [import-parquet.ts](file:///d:/quant-web/services/data-center/src/commands/import-parquet.ts) | 编译通过 |
| 阶段1-4: 端到端验证 | 试导 2 daily + 1 weekly → 14347+1249 条 | DB 抽查通过 |
| P1-D: connection.ts 迁移补齐 5 个 valuation 新列 | [connection.ts](file:///d:/quant-web/services/data-center/src/storage/sqlite/connection.ts) | data-center 47/47 测试通过 |
| P1-C: MootdxAdapter 增强（trade_record/l2_snapshot/f10） | [mootdx-adapter.ts](file:///d:/quant-web/services/data-collector/src/adapters/mootdx-adapter.ts) + [cleaner.ts](file:///d:/quant-web/services/data-collector/src/cleaner.ts) + [scheduler.ts](file:///d:/quant-web/services/data-collector/src/scheduler.ts) | data-collector 69/69 测试通过 |
| P1-E: external_records 表 + ExternalRecordRepository | [schema.ts](file:///d:/quant-web/services/data-center/src/storage/schema.ts) + [external-repo.ts](file:///d:/quant-web/services/data-center/src/storage/sqlite/external-repo.ts) + [factory.ts](file:///d:/quant-web/services/data-center/src/storage/factory.ts) | 同上 |
| P1-F: 8 个东财新适配器 + scheduler external 分支 | [eastmoney/](file:///d:/quant-web/services/data-collector/src/adapters/eastmoney/) 目录 8 个适配器 + [source-selector.ts](file:///d:/quant-web/services/data-collector/src/source-selector.ts) | 同上 |
| P1-G: 回归验证 + 文档同步 | README.md / AGENT.md 同步 | `pnpm -r build` 5 包通过；`pnpm -r test` 377/377 测试通过 |

**Phase 1 + P1 全部完成** — 3 星 + 2 星优先级全部落地，1 星优先级（P2-H/I/J/K）保留待后续按需启用。

### 最终回归验证

- `pnpm -r build` — 5 个包编译通过（apps/web, services/data-center, apps/api, services/data-collector, apps/worker）
- `pnpm -r test` — 377/377 测试通过：
  - data-center: 47/47
  - data-collector: 69/69
  - apps/web: 114/114
  - apps/api: 122/122
  - apps/worker: 25/25

---

## 一、摘要

本方案分两条主线推进：

1. **数据源增强（按优先级）**：修复/补强现有 8 个适配器，并新增 5 个适配器，覆盖 a-stock-data 中的关键数据源
2. **Parquet 数据入库（按阶段）**：把 `E:\quant-data` 的 36434 个 parquet 文件（约 989MB K 线 + 20.79GB L2）接入数据中心，供回测使用

两条主线在 Phase 1 末尾汇合：ParquetAdapter 既是数据源增强的一部分，也是 Parquet 入库的载体。

---

## 二、当前状态分析

### 2.1 已完成（前一会话）

| 项目 | 状态 | 文件 |
|------|------|------|
| P0-A: mootdx tdx_client 三级 fallback | ✅ 已完成 | [mootdx-adapter.ts](file:///d:/quant-web/services/data-collector/src/adapters/mootdx-adapter.ts) |
| mootdx categoryMap `'1M'` → `'1mo'` | ✅ 已完成 | 同上 |
| 构建验证（58 测试通过） | ✅ 已完成 | `pnpm --filter @quant/data-collector test` |

### 2.2 现有代码基线

**data-center（[schema.ts](file:///d:/quant-web/services/data-center/src/storage/schema.ts)）**：
- `bars` 表：symbol/timeframe/timestamp + OHLCV + turnover/openInterest/numTrades
- `TimeFrame` 枚举（[types.ts](file:///d:/quant-web/services/data-center/src/base/types.ts)）：仅 `M1='1m' / M5='5m' / M15='15m' / H1='1h' / D1='1d'`（5 个，缺周/月/季/年）
- `RepositorySet`（[repository/types.ts](file:///d:/quant-web/services/data-center/src/repository/types.ts)）：20 个 repo，无 `externalRecords`
- 无 `external_records` 表

**data-collector**：
- 9 个适配器文件（csv/tushare/akshare/baostock/efinance/yfinance/mootdx/tencent + types/index）
- 无 `eastmoney/` 目录，无 `em-client.ts`
- 无 `ParquetAdapter`
- [source-selector.ts](file:///d:/quant-web/services/data-collector/src/source-selector.ts) 优先级链：`bar: mootdx → akshare → baostock → efinance → yfinance → tushare`
- [scheduler.ts](file:///d:/quant-web/services/data-collector/src/scheduler.ts) `writeToDataCenter` 分支：bar/tick/instrument/financial_report/adjustment_factor/calendar/announcement_event/news/shareholder_metrics/valuation（10 类，无 `external` 分支）

**import-data 命令（[import-data.ts](file:///d:/quant-web/services/data-center/src/commands/import-data.ts)）**：
- 现有命令从 AKShare 拉取写入 data-center
- 无 `import-parquet` 命令

### 2.3 E:\quant-data 数据资产

| 数据类型 | 文件数 | 体积 | schema | 入库策略 |
|---------|--------|------|--------|---------|
| bars/daily | 7170 | 626MB | symbol,timeframe,timestamp,open,high,low,close,volume,turnover | 入 SQLite |
| bars/weekly | 7316 | 188MB | 同上 | 入 SQLite |
| bars/monthly | 7316 | 79MB | 同上 | 入 SQLite |
| bars/quarterly | 7316 | 53MB | 同上 | 入 SQLite |
| bars/yearly | 7316 | 43MB | 同上 | 入 SQLite |
| l2/trade | 370 | 20.79GB | symbol,timestamp,price,volume,side,trade_type | **不入 SQLite**（Phase 2 流式读 parquet） |
| l2/order | - | ~20GB | symbol,timestamp,price,volume,action,order_type | 同上 |
| l2/snapshot | - | ~15GB | symbol,timestamp,bids,asks | 同上 |

**关键差异**：parquet 的 `timeframe` 字段值为 `daily/weekly/monthly/quarterly/yearly`（小写字面量），而 data-center `TimeFrame` 枚举只有 `1m/5m/15m/1h/1d`。需要在 Phase 1 扩展枚举并在 ParquetAdapter 做映射。

---

## 三、优先级分类（3 星 / 2 星 / 1 星）

### ★★★ 三星优先级（P0 — 必做，阻塞主流程）

| ID | 任务 | 状态 | 说明 |
|----|------|------|------|
| P0-A | mootdx tdx_client 三级 fallback | ✅ 已完成 | 修复 mootdx 0.11.x BESTIP.HQ 空串崩溃 |
| P0-B | em-client.ts 东财统一限流基础设施 | ✅ 已完成 | 新建 `services/data-collector/src/adapters/eastmoney/em-client.ts`，7 测试通过 |

### ★★ 二星优先级（P1 — 应做，提升数据覆盖）

| ID | 任务 | 状态 | 说明 |
|----|------|------|------|
| P1-C | MootdxAdapter 增强 | ✅ 已完成 | 新增 trade_record / l2_snapshot / f10 数据类型（原计划 tick/l2_quote 调整为 canonical 名称避免 scheduler 冲突） |
| P1-D | TencentAdapter 字段补全 | ✅ 已完成 | 补齐 47/48/49/43/52 字段（5 日均量/量比/委差/涨停跌停/PE）；connection.ts 迁移已修复 |
| P1-E | data-center external_records 表 | ✅ 已完成 | 通用表承载 8 类新数据类型（龙虎榜/限售/融资融券/大宗交易/分红/研报/热门股/北向资金） |
| P1-F | 8 个东财新适配器 + scheduler external 分支 | ✅ 已完成 | eastmoney/dragon-tiger 等共 8 个适配器，复用 emClient；scheduler 新增 external 分支 |
| P1-G | 回归验证 + 文档同步 | ✅ 已完成 | 全量 build + test + README/AGENT.md 同步 |

### ★ 一星优先级（保留 — 后续按需启用）

| ID | 任务 | 说明 |
|----|------|------|
| P2-H | L2 Parquet 流式 Repository | `ParquetTradeRecordRepository` 直读 parquet，不落 SQLite |
| P2-I | 因子结果入库 | factors/ddx_ddy_daily.parquet → external_records 或独立表 |
| P2-J | PostgreSQL 迁移准备 | schema 已兼容，driver 切换 |
| P2-K | a-stock-data 其余数据源 | 财经日历/概念板块/融资融券明细等 |

---

## 四、阶段划分（Phase 1 / 2 / 3）

### Phase 1 — K 线 Parquet 入库（✅ 已完成）

| 步骤 | 任务 | 依赖 | 状态 |
|------|------|------|------|
| 1-1 | TimeFrame 枚举扩展（W1/Mo1/Q1/Y1） | 无 | ✅ 已完成 |
| 1-2 | ParquetAdapter（Python + pyarrow 桥接） | 1-1 | ✅ 已完成 |
| 1-3 | import-parquet 命令 | 1-2 | ✅ 已完成 |
| 1-4 | 端到端验证 | 1-3 | ✅ 已完成 |

**目标**：把 `E:\quant-data\bars\{daily,weekly,monthly,quarterly,yearly}` 共 36434 个 parquet 文件导入 data-center SQLite，供回测引擎直接使用。

### Phase 2 — L2 数据流式查询（保留空间，不在本阶段实施）

- `ParquetTradeRecordRepository` 实现 `TradeRecordRepository` 接口，直读 parquet
- `ParquetOrderRecordRepository`、`ParquetLevel2SnapshotRepository` 同理
- 不落 SQLite，回测引擎通过 Repository 接口流式读取
- 依赖 Phase 1 的 ParquetAdapter 基础设施

### Phase 3 — 因子结果 & 扩展数据（保留空间，不在本阶段实施）

- factors/ddx_ddy_daily.parquet 入库（走 external_records 或独立 factor_results 表）
- P1-F 的 5 个新适配器数据落 external_records
- 依赖 Phase 1 的 ParquetAdapter + P1-E 的 external_records 表

---

## 五、具体变更方案

### 5.1 P0-B: em-client.ts 东财统一限流基础设施

**文件**：`services/data-collector/src/adapters/eastmoney/em-client.ts`（新建）

**What**：单例 HTTP 客户端，封装东财所有请求的限流/重试/会话复用。

**Why**：东财对 IP 敏感，裸 fetch 会被 403/429。a-stock-data 的 `em_get()` 模式（≥1s 间隔 + 抖动 + 429/5xx 退避 + 403 不重试）是验证过的稳定方案，所有东财相关适配器（P1-F 的 5 个）共用此客户端。

**How**：
```typescript
class EMClient {
  private lastRequestAt = 0;
  private queue = Promise.resolve();
  private session: { cookie: string; expiresAt: number } | null = null;
  private readonly MIN_INTERVAL = 1000; // ≥1s
  private readonly JITTER = 500; // 0-500ms 随机抖动
  private readonly MAX_RETRY = 3;

  async get(url: string, params?: Record<string, string>): Promise<unknown> {
    // 串行队列：所有请求排队执行
    return this.queue = this.queue.then(() => this._doGet(url, params));
  }

  private async _doGet(url: string, params?: Record<string, string>): Promise<unknown> {
    await this.waitInterval();
    const cookie = await this.ensureSession();
    // fetch + 重试：429/5xx 指数退避 3 次，403 不重试直接抛
  }

  private async waitInterval(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const need = this.MIN_INTERVAL + Math.random() * this.JITTER;
    if (elapsed < need) await sleep(need - elapsed);
    this.lastRequestAt = Date.now();
  }

  private async ensureSession(): Promise<string> {
    // 会话复用：cookie 未过期直接返回，否则重新请求首页拿 cookie
  }
}
export const emClient = new EMClient(); // 模块单例
```

**测试**：`services/data-collector/tests/em-client.test.ts`
- 验证限流间隔（连续 2 次请求间隔 ≥1000ms）
- 验证 429 重试（mock fetch 返回 429，验证重试 3 次）
- 验证 403 不重试（mock fetch 返回 403，验证直接抛错）

### 5.2 阶段1-1: TimeFrame 枚举扩展

**文件**：[services/data-center/src/base/types.ts](file:///d:/quant-web/services/data-center/src/base/types.ts)

**What**：扩展 TimeFrame 枚举，新增 4 个值。

**Why**：`E:\quant-data` 的 parquet 文件 timeframe 字段为 `daily/weekly/monthly/quarterly/yearly`，但 data-center 只有 `1m/5m/15m/1h/1d`。回测引擎需要周/月/季/年 K 线。

**How**：
```typescript
export enum TimeFrame {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  H1 = '1h',
  D1 = '1d',
  W1 = '1w',    // 新增：周线
  Mo1 = '1mo',  // 新增：月线（全小写，避免与 1m 歧义）
  Q1 = '1q',    // 新增：季线
  Y1 = '1y',    // 新增：年线
}
```

**全小写决策**：与 mootdx categoryMap 已修复的 `'1mo'` 对齐；避免 `'1M'`（月）与 `'1m'`（分钟）大小写歧义。

**影响范围**：
- `TimeFrame` 枚举扩展后，所有 `switch(timeframe)` / `Record<string, ...>` 需检查是否需要补 case
- `bars` 表的 `timeframe` 字段是 `text`，无需 schema 迁移
- 回测引擎、前端、API 层通过 `TimeFrame.X` 引用，自动获得新值

### 5.3 阶段1-2: ParquetAdapter（Python + pyarrow 桥接）

**文件**：`services/data-collector/src/adapters/parquet-adapter.ts`（新建）

**What**：实现 `DataSourceAdapter` 接口，通过 Python 子进程调用 pyarrow 流式读取 parquet 文件。

**Why**：Node.js 生态没有成熟的 parquet 流式读取库（`parquetjs` 维护停滞、不支持 snappy）；pyarrow 是 Python 生态标准，`ParquetFile.iter_batches()` 天然支持流式。复用现有 Python 桥接模式（mootdx/akshare/baostock）。

**How**：
```typescript
export class ParquetAdapter implements DataSourceAdapter {
  name = 'parquet';
  supportedDomains = ['market'];
  supportedDataTypes = ['bar', 'tick', 'trade_record', 'order_record', 'l2_snapshot'];

  async *fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord> {
    const extra = options.extra as ParquetExtra;
    // extra.filePath: 单文件路径
    // extra.fileDir: 目录路径（批量读取）
    // extra.timeframeMap: parquet timeframe → TimeFrame 枚举映射
    const script = this.buildScript(options);
    const { stdout } = await execFileAsync(pythonPath, ['-c', script], { maxBuffer: 200 * 1024 * 1024 });
    // stdout 是 NDJSON（每行一个 JSON 对象），流式 yield
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue;
      yield JSON.parse(line);
    }
  }

  private buildScript(options: AdapterFetchOptions): string {
    // Python 脚本：
    // 1. pyarrow.ParquetFile(filePath).iter_batches(batch_size=1000)
    // 2. 每个 batch 转 dict，逐行 print(json.dumps(row))
    // 3. timeframe 映射：daily→1d, weekly→1w, monthly→1mo, quarterly→1q, yearly→1y
    // 4. timestamp 已是毫秒，直接透传
    // 5. symbol 透传（已是 XXXXXX.SH/SZ/BJ 格式）
  }
}
```

**timeframe 映射表**（parquet 字面量 → TimeFrame 枚举值）：
| parquet 值 | TimeFrame 枚举 | 枚举值 |
|-----------|---------------|--------|
| daily | D1 | '1d' |
| weekly | W1 | '1w' |
| monthly | Mo1 | '1mo' |
| quarterly | Q1 | '1q' |
| yearly | Y1 | '1y' |

**ParquetExtra 类型**（加到 [adapters/types.ts](file:///d:/quant-web/services/data-collector/src/adapters/types.ts)）：
```typescript
export interface ParquetExtra {
  filePath?: string;        // 单文件
  fileDir?: string;         // 目录（批量）
  pythonPath?: string;      // 默认 'python'
  batchSize?: number;       // 默认 1000
  timeframeMap?: Record<string, string>; // 默认 daily→1d, weekly→1w, ...
}
```

### 5.4 阶段1-3: import-parquet 命令

**文件**：`services/data-center/src/commands/import-parquet.ts`（新建）

**What**：CLI 命令，扫描 `E:\quant-data\bars\{daily,weekly,monthly,quarterly,yearly}` 目录，调用 ParquetAdapter + CollectorScheduler 写入 data-center SQLite。

**Why**：复用现有 `import-data.ts` 的模式（createDataCenter → registry → scheduler → execute），只是数据源从 AKShare 换成 parquet 文件。

**How**：
```typescript
// 用法: npx tsx src/commands/import-parquet.ts <rootDir> [timeframes...]
// 示例: npx tsx src/commands/import-parquet.ts E:/quant-data/bars daily weekly monthly
async function main() {
  const rootDir = process.argv[2] ?? 'E:/quant-data/bars';
  const timeframes = process.argv.slice(3); // ['daily','weekly','monthly','quarterly','yearly']

  const dc = await createDataCenter();
  const registry = new AdapterRegistryImpl();
  registry.register(new ParquetAdapter());
  const scheduler = new CollectorScheduler(registry, dc.repos);

  for (const tf of timeframes) {
    const dir = `${rootDir}/${tf}`;
    const files = await fs.readdir(dir).then(fs => fs.filter(f => f.endsWith('.parquet')));
    for (const file of files) {
      const symbol = file.replace('.parquet', ''); // 600519.SH
      const task: CollectorTask = {
        id: `parquet-${tf}-${symbol}`,
        domain: 'market',
        dataType: 'bar',
        source: 'parquet',
        symbols: [symbol],
        timeframes: [TIMEFRAME_MAP[tf]], // daily→'1d'
      };
      const results = await scheduler.execute(task, { filePath: `${dir}/${file}` });
      console.log(`[import-parquet] ${symbol} ${tf}: ${results[0].recordsWritten} bars`);
    }
  }
  dc.flush(); await dc.close();
}
```

**TIMEFRAME_MAP**：`{ daily:'1d', weekly:'1w', monthly:'1mo', quarterly:'1q', yearly:'1y' }`

### 5.5 阶段1-4: 端到端验证

**验证步骤**：
1. `pnpm --filter @quant/data-center build` — 验证 TimeFrame 扩展不破坏编译
2. `pnpm --filter @quant/data-center test` — 验证现有测试通过
3. `pnpm --filter @quant/data-collector build` — 验证 ParquetAdapter + em-client 编译
4. `pnpm --filter @quant/data-collector test` — 验证新测试通过
5. `npx tsx services/data-center/src/commands/import-parquet.ts E:/quant-data/bars daily` — 试导 1 个周期
6. 抽查：`sqlite3 quant.db "SELECT symbol, timeframe, COUNT(*) FROM bars WHERE timeframe='1d' GROUP BY symbol, timeframe LIMIT 5"`
7. 全量导入：`npx tsx ... import-parquet.ts E:/quant-data/bars daily weekly monthly quarterly yearly`

---

## 六、P1 任务概要（2 星优先级，Phase 1 完成后实施）

### P1-C: MootdxAdapter 增强
- 新增 `supportedDataTypes: ['bar', 'tick', 'l2_quote', 'f10']`
- `tick`：`client.transaction(symbol, offset=500)` 返回逐笔成交
- `l2_quote`：`client.quotes(symbol)` 返回五档盘口
- `f10`：`client.finance(symbol)` 返回 F10 财务摘要

### P1-D: TencentAdapter 字段补全
- 现有字段 39/44/45/46/38（PE/PB/总市值/流通市值/换手率）
- 补齐 47/48/49/43/52（5 日均量/量比/委差/涨停/跌停）

### P1-E: external_records 表
**文件**：[schema.ts](file:///d:/quant-web/services/data-center/src/storage/schema.ts) + [repository/types.ts](file:///d:/quant-web/services/data-center/src/repository/types.ts) + [factory.ts](file:///d:/quant-web/services/data-center/src/storage/factory.ts)
```typescript
export const externalRecords = sqliteTable('external_records', {
  id: text('id').primaryKey(),
  dataType: text('data_type').notNull(), // dragon_tiger/lockup/margin/block_trade/dividend/research_report/hot_stocks/northbound_flow
  symbol: text('symbol').notNull(),
  timestamp: integer('timestamp').notNull(),
  payload: text('payload').notNull(), // JSON
  source: text('source').notNull(),
}, (t) => [
  index('idx_ext_type_symbol').on(t.dataType, t.symbol),
  index('idx_ext_ts').on(t.timestamp),
]);

export interface ExternalRecordRepository {
  save(records: ExternalRecord[]): Promise<void>;
  query(dataType: string, symbol?: string, start?: number, end?: number): Promise<ExternalRecord[]>;
}
```

### P1-F: 5 个新适配器 + scheduler external 分支
- `eastmoney/dragon-tiger-adapter.ts`（龙虎榜）
- `eastmoney/lockup-adapter.ts`（限售解禁）
- `eastmoney/margin-adapter.ts`（融资融券）
- `eastmoney/block-trade-adapter.ts`（大宗交易）
- `eastmoney/dividend-adapter.ts`（分红送转）
- `eastmoney/research-adapter.ts`（研报）
- `eastmoney/hot-stocks-adapter.ts`（热门股）
- `eastmoney/northbound-adapter.ts`（北向资金）
- 全部复用 `emClient` 单例
- `scheduler.ts` `writeToDataCenter` 新增 `case 'external':` 分支

### P1-G: 回归验证 + 文档同步
- 全量 `pnpm build && pnpm test`
- 同步 [services/data-collector/README.md](file:///d:/quant-web/services/data-collector/README.md)（适配器清单、优先级链路）
- 同步 [services/data-collector/AGENT.md](file:///d:/quant-web/services/data-collector/AGENT.md)
- 同步 [services/data-center/AGENT.md](file:///d:/quant-web/services/data-center/AGENT.md)（external_records 表、TimeFrame 扩展）

---

## 七、假设与决策

### 已确认决策（前一会话 AskUserQuestion）
1. **新数据类型存储**：通用 `external_records` 表（vs 每类独立表）— ✅ 用户确认
2. **Parquet 读取方式**：Python + pyarrow 桥接（vs 纯 Node.js）— ✅ 用户确认
3. **TimeFrame 枚举值**：全小写 `1w/1mo/1q/1y`（vs 大小写混合）— ✅ 用户确认

### 假设
- `E:\quant-data` 路径在运行环境可用（本机 Windows，路径稳定）
- Python 环境已安装 `pyarrow`（前一会话已 `pip install pyarrow`，v24.0.0）
- `E:\quant-data\bars\*` parquet 文件 schema 一致（consolidation_report.md 已验证）
- L2 数据（20GB+）本阶段不入 SQLite，Phase 2 用流式 Repository 直读 parquet
- `bars` 表的 `text` 类型 `timeframe` 字段无需 schema 迁移即可承载新枚举值

### 边界遵守（AGENTS.md）
- data-collector 只做拉取/清洗/写入，不感知业务 — ✅ ParquetAdapter 符合
- data-center 只做存储/查询，不感知业务 — ✅ external_records 通用表符合
- TimeFrame 类型归属 data-center — ✅ 在 data-center 扩展
- Python 桥接通过 execFile 子进程，不直接 import — ✅ 复用 mootdx 模式

---

## 八、验证步骤

### Phase 1 完成标准
```bash
# 1. 编译
pnpm --filter @quant/data-center build
pnpm --filter @quant/data-collector build

# 2. 测试
pnpm --filter @quant/data-center test
pnpm --filter @quant/data-collector test

# 3. 试导（单周期单标的）
npx tsx services/data-center/src/commands/import-parquet.ts E:/quant-data/bars/daily/600519.SH.parquet

# 4. 抽查数据库
sqlite3 quant.db "SELECT timeframe, COUNT(*) FROM bars GROUP BY timeframe"

# 5. 全量导入
npx tsx services/data-center/src/commands/import-parquet.ts E:/quant-data/bars daily weekly monthly quarterly yearly
```

### P0-B 完成标准
```bash
pnpm --filter @quant/data-collector test -- em-client
# 验证：限流间隔 ≥1000ms、429 重试 3 次、403 不重试
```

### P1 完成标准
```bash
pnpm -r build && pnpm -r test
# 所有包编译通过、测试通过
# README.md / AGENT.md 已同步
```

---

## 九、实施顺序建议

```
P0-A (已完成 ✅)
  ↓
P0-B (em-client.ts) (已完成 ✅)
  ↓
阶段1-1 (TimeFrame 扩展) (已完成 ✅)
  ↓
阶段1-2 (ParquetAdapter) (已完成 ✅)
  ↓
阶段1-3 (import-parquet 命令) (已完成 ✅)
  ↓
阶段1-4 (端到端验证) (已完成 ✅)  ←  Phase 1 完成
  ↓
P1-D (connection.ts 迁移修复) (已完成 ✅)
  ↓
P1-C (Mootdx 增强 trade_record/l2_snapshot/f10) (已完成 ✅)
  ↓
P1-E (external_records 表) (已完成 ✅)
  ↓
P1-F (8 个东财新适配器) (已完成 ✅)
  ↓
P1-G (回归 + 文档同步) (已完成 ✅)  ←  P1 完成
  ↓
[保留] P2-H/I/J/K（1 星优先级，后续按需启用）
```

### Phase 1 + P1 全部完成 ✅

- 3 星优先级（P0-A/B）：mootdx fallback + 东财限流基础设施
- Phase 1：TimeFrame 扩展 + ParquetAdapter + import-parquet 命令 + 端到端验证
- 2 星优先级（P1-C/D/E/F/G）：Mootdx 增强 + Tencent 字段补全 + external_records 表 + 8 个东财适配器 + 回归文档
- 最终回归：`pnpm -r build` 5 包通过；`pnpm -r test` 377/377 测试通过
- 1 星优先级（P2-H/I/J/K）保留待后续按需启用

---

## 十、风险与缓解

| 风险 | 缓解 |
|------|------|
| pyarrow 流式读取大文件 OOM | `iter_batches(batch_size=1000)`，逐批 yield |
| 36434 个文件导入耗时过长 | 串行 + 进度日志；可后续并行化（Phase 2 优化） |
| TimeFrame 扩展破坏现有 switch | 全量编译 + 测试覆盖；`text` 字段无需迁移 |
| 东财 403 封 IP | em-client ≥1s 间隔 + 抖动 + 会话复用；403 不重试直接抛错 |
| L2 数据 20GB 入 SQLite 卡死 | Phase 1 不入 SQLite，Phase 2 流式 Repository |
| parquet schema 不一致 | consolidation_report.md 已验证 5 个周期 schema 一致 |

---

## 十一、Phase 2/3 保留空间

### Phase 2（L2 流式查询，本阶段不实施）
- 新增 `services/data-center/src/storage/parquet/parquet-trade-repo.ts`
- 实现 `TradeRecordRepository` 接口，`query()` 直读 parquet
- 回测引擎通过 `RepositorySet.tradeRecords` 透明访问，不感知存储介质
- 依赖 Phase 1 的 ParquetAdapter Python 桥接基础设施

### Phase 3（因子结果 & 扩展数据，本阶段不实施）
- `factors/ddx_ddy_daily.parquet` 入 `external_records`（dataType='factor_result'）
- 或独立 `factor_results` 表（视因子工坊 Agent 讨论）
- P1-F 的 8 类东财数据落 `external_records`
- 依赖 Phase 1 的 ParquetAdapter + P1-E 的 external_records 表
