# P1-G 文档同步执行计划

> 创建时间：2026-07-06（Asia/Shanghai）
> 任务来源：数据源增强 & Parquet 导入主计划的收尾步骤
> 状态：Phase 1 实施已完成（P1-C/D/E/F 全部代码落地 + 377 测试通过），仅剩文档同步

---

## 一、当前状态

### 已完成（代码层面全部落地）

| 任务 | 验证结果 |
|------|---------|
| P1-D: connection.ts 迁移补齐 5 个 valuation 新列 | data-center 47/47 测试通过 |
| P1-C: MootdxAdapter 增强（trade_record/l2_snapshot/f10） | data-collector 69/69 测试通过 |
| P1-E: external_records 表 + ExternalRecordRepository | 同上 |
| P1-F: 8 个东财新适配器 + scheduler external 分支 | 同上 |
| 全量回归 | `pnpm -r build` 5 包编译通过；`pnpm -r test` 377/377 测试通过 |

### 待完成（本计划范围）

P1-G 的文档同步部分——3 个文件需要更新以反映新能力。

---

## 二、需要同步的文档差异

### 2.1 services/data-collector/README.md

**当前状态**：描述 8 个适配器，优先级链未包含新数据类型，DataCleaner 支持类型列表过时。

**需要更新**：
1. **适配器清单**（8 → 17 个）：
   - 新增 `ParquetAdapter`（Python + pyarrow 桥接，流式读取本地 parquet 文件，支持 bar/tick/trade_record/order_record/l2_snapshot）
   - 新增 8 个东财适配器（全部复用 emClient 单例）：
     - `DragonTigerAdapter`（龙虎榜，RPT_DAILYBILLBOARD_DETAILS）
     - `LockupAdapter`（限售解禁，RPT_SHARE_FLOATING_NPL）
     - `MarginAdapter`（融资融券，RPTA_WEB_RZRQ_GGMX）
     - `BlockTradeAdapter`（大宗交易，RPT_BLOCKTRADE_DETAIL）
     - `DividendAdapter`（分红送转，RPT_SHAREBONUS_DET）
     - `ResearchReportAdapter`（研报，reportapi.eastmoney.com）
     - `HotStocksAdapter`（热门股，push2 API）
     - `NorthboundFlowAdapter`（北向资金，push2his kamnt.kline）
   - 新增 `emClient` / `EastMoneyBaseAdapter`（基础设施，非独立适配器）

2. **数据源优先级链路**（新增 11 个数据类型）：
   ```
   trade_record:     mootdx
   l2_snapshot:      mootdx
   f10:              mootdx
   dragon_tiger:     eastmoney_dragon_tiger
   lockup:           eastmoney_lockup
   margin:           eastmoney_margin
   block_trade:      eastmoney_block_trade
   dividend:         eastmoney_dividend
   research_report:  eastmoney_research
   hot_stocks:       eastmoney_hot_stocks
   northbound_flow:  eastmoney_northbound
   ```
   - 修正 `valuation` 链路：`baostock → tushare → tencent`（tencent 已接入）
   - 删除"tencent 未接入 source-selector"的旧注释

3. **DataCleaner 支持类型**：新增 `trade_record`、`l2_snapshot`

4. **scheduler writeToDataCenter 分支**：从 10 类扩展到 13 类（新增 trade_record/l2_snapshot/external）

5. **Python 依赖**：新增 `pyarrow`（ParquetAdapter 需要）

6. **createCollector 默认启用源**：新增 ParquetAdapter 注册说明（默认不启用，需显式开启）

7. **子模块规划表**：`src/adapters/` 行更新为包含 eastmoney/ 子目录

### 2.2 services/data-collector/AGENT.md

**当前状态**：与 README.md 同步过时。

**需要更新**：与 README.md 相同的内容变更（适配器清单、优先级链、DataCleaner 类型、Python 依赖），格式保持 AGENT.md 风格。

### 2.3 services/data-center/AGENT.md

**当前状态**：描述 17 个 Repository，TimeFrame 列表不完整，未提及 external_records 表。

**需要更新**：
1. **当前阶段**：测试数从 43 更新为 47
2. **已有能力**：
   - SQLite Repository 从 17 个扩展到 18 个（新增 `SqliteExternalRecordRepository`）
   - 新增 `external_records` 通用表（承载 8 类东财扩展数据 + 未来因子结果）
   - 新增 `ExternalRecordRepository` 接口
3. **拥有的类型**：`TimeFrame` 枚举值扩展说明（新增 W1='1w' / Mo1='1mo' / Q1='1q' / Y1='1y'）

---

## 三、具体变更方案

### 变更 1: services/data-collector/README.md

**What**：全面更新适配器清单、优先级链路、依赖清单。

**Why**：P1-C/D/E/F 新增了 1 个 ParquetAdapter + 8 个东财适配器 + 3 个 mootdx 新数据类型 + tencent 接入优先级链，README 必须反映这些变化才能作为准确的能力索引。

**How**：
- 第 8 行 "已对接 8 个数据源" → "已对接 17 个数据源适配器（9 个独立源 + 8 个东财子源）"
- 第 14-31 行 "已完成" 列表：
  - 适配器列表追加 ParquetAdapter + 8 个东财适配器 + emClient/EastMoneyBaseAdapter 基础设施
  - DataCleaner 支持类型追加 trade_record/l2_snapshot
  - createCollector 默认启用源说明更新（parquet/东财默认不启用，需显式开启）
- 第 39 行子模块表 `src/adapters/` 列追加 `+ eastmoney/ 子目录`
- 第 56-66 行优先级链：追加 11 个新数据类型，修正 valuation 链
- 删除第 68 行 tencent 未接入注释
- 第 106 行 pip install 追加 `pyarrow`
- 追加 `tencent 走 HTTP 直连，无需 Python 依赖；东财适配器走 HTTP 直连 emClient，无需 Python 依赖；ParquetAdapter 需 pyarrow`

### 变更 2: services/data-collector/AGENT.md

**What**：与 README.md 同步更新。

**Why**：AGENT.md 是子项目 Agent 协作约束文件，必须与实际能力一致。

**How**：与 README.md 相同的内容变更，格式保持 AGENT.md 现有风格（"已有能力"代码块）。

### 变更 3: services/data-center/AGENT.md

**What**：更新 Repository 数量、测试数、TimeFrame 说明、external_records 表。

**Why**：P1-D 新增 5 个 valuation 列、P1-E 新增 external_records 表 + ExternalRecordRepository、Phase 1 扩展了 TimeFrame 枚举，AGENT.md 必须反映。

**How**：
- 第 15 行 "43 个测试通过" → "47 个测试通过"
- 第 24 行 "17 个 Repository：含 shareholder_metrics" → "18 个 Repository：含 shareholder_metrics + externalRecords"
- 第 28 行后追加：external_records 通用表说明（承载东财 8 类扩展数据，通过 ExternalRecordRepository 接口访问）
- 第 96 行 TimeFrame 拥有类型说明：追加 "（含 W1/Mo1/Q1/Y1 周/月/季/年线，Phase 1 扩展）"

### 变更 4: 更新主计划文档进度

**What**：更新 `data-source-enhancement-and-parquet-import-plan.md` 的进度标记。

**Why**：P1-G 完成后，整个 Phase 1 + P1 全部完成，主计划应反映最终状态。

**How**：
- "进行中" 区块的 P1-D 标记为已完成
- "待做" 区块的 P1-C/E/F/G 全部标记为已完成
- "实施顺序建议" 流程图全部标记为已完成
- 追加 "Phase 1 + P1 全部完成" 总结行

---

## 四、验证步骤

```bash
# 1. 文档同步后，确认无遗漏
# - 检查 README.md 适配器数量与 src/adapters/index.ts 导出一致
# - 检查优先级链与 source-selector.ts SOURCE_PRIORITY 一致
# - 检查 AGENT.md Repository 数量与 factory.ts 注册一致

# 2. 确认代码未被改动（仅文档变更）
git status
# 期望：仅 4 个 .md 文件有变更

# 3. 最终回归（保险起见）
pnpm -r build
pnpm -r test
# 期望：5 包编译通过，377 测试通过
```

---

## 五、假设与决策

### 假设
- 文档同步仅修改 .md 文件，不触碰任何 .ts 代码
- 现有 377 测试通过的基线不变
- 东财适配器默认不启用（与 mootdx/tencent 一致，需 createCollector 显式开启）

### 决策
- **东财适配器默认启用策略**：与 mootdx/tencent 一致，默认不启用，避免无网络/无需求时加载 emClient。用户需 `createCollector({sources:[..., 'eastmoney_dragon_tiger', ...]})` 显式开启。
- **ParquetAdapter 默认启用策略**：默认不启用，需显式开启（依赖本地 parquet 文件路径）。
- **文档措辞**：使用 "17 个数据源适配器（9 个独立源 + 8 个东财子源）" 而非 "17 个数据源"，因为东财 8 个适配器共享 emClient 基础设施。

---

## 六、执行顺序

```
1. 更新 services/data-collector/README.md
2. 更新 services/data-collector/AGENT.md（与 README 同步）
3. 更新 services/data-center/AGENT.md
4. 更新主计划文档 .trae/documents/data-source-enhancement-and-parquet-import-plan.md 进度标记
5. git status 确认仅 .md 文件变更
6. 标记 Task #26 完成
7. 返回最终总结
```

**预计工作量**：4 个文件的文本编辑，无代码变更，无测试运行（除非最终回归保险）。
