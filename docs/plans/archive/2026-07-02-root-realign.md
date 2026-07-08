# 根目录文档对齐 backend-sync-realign 实现计划

> **状态（2026-07-08）：已归档。** 根目录文档已对齐 canonical 契约。对应 spec：`docs/specs/2026-07-02-root-realign-design.md`。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将根目录 README.md / AGENT.md / AGENTS.md / CLAUDE.md 对齐到 contract-realign plan Phase 0-5 已落地状态。

**Architecture:** 纯文档更新，无代码/测试/配置改动。按文件分 4 个独立任务，每个任务单独提交。编辑使用精确字符串替换，保证只改目标段落。

**Tech Stack:** Markdown 文档。

## Global Constraints

- 所有回复使用中文
- 遵循 KISS 原则，不修改无关文件
- 仅描述 Phase 0-5 已落地内容，不描述 Phase 6-9 未完成内容
- 不重写 plan 内容，AGENT.md 用文件链接指向 plan
- Git 提交在当前 `ralph/backend-sync-realign` 分支
- 每个 Task 结束后独立提交，commit message 用 `docs:` 前缀

**Spec:** `docs/specs/2026-07-02-root-md-realign-design.md`

---

## File Map

| File        | Action | Responsibility                                                             |
| ----------- | ------ | -------------------------------------------------------------------------- |
| `CLAUDE.md` | Delete | 移除过时且与 AGENT.md 重复的文档                                           |
| `README.md` | Modify | 核心闭环补 diagnostics/预览；新增核心契约小节；已连通链路补 canonical 契约 |
| `AGENT.md`  | Modify | 当前阶段更新；已知陷阱补 ConfigSnapshot/ResultProcessor 两条               |
| `AGENTS.md` | Modify | 类型归属原则补列新类型；协作接口措辞对齐                                   |

---

### Task 1: 删除 CLAUDE.md

**Files:**

- Delete: `CLAUDE.md`

**Interfaces:**

- Consumes: 无
- Produces: 无（纯删除）

- [ ] **Step 1: 删除文件**

使用 DeleteFile 工具删除 `d:\quant-web\CLAUDE.md`。

- [ ] **Step 2: 验证删除**

Run: `git status --short`
Expected: 输出含 `D CLAUDE.md`

- [ ] **Step 3: 提交**

```bash
git add CLAUDE.md
git commit -m "docs: remove stale CLAUDE.md"
```

---

### Task 2: 更新 README.md

**Files:**

- Modify: `README.md:5-11`（核心闭环）
- Modify: `README.md:13`（在"模块连接图"前插入"核心契约"小节）
- Modify: `README.md:63-71`（已连通链路）

**Interfaces:**

- Consumes: 无
- Produces: 无

- [ ] **Step 1: 更新"核心闭环"段落**

用 Edit 工具替换。

old_string:

````
## 核心闭环

```text
选择策略 → 配置参数 → 运行回测/训练 → 查看任务和报告 → 迭代策略
````

前后端端到端闭环已打通：前端提交回测 → API → Worker → Python CLI → 真实回测指标 → SSE 推送 → 前端报告显示。

```

new_string:
```

## 核心闭环

```text
选择策略 → 配置参数 → 预览/诊断 → 运行回测 → 查看任务和报告 → 迭代策略
```

前后端端到端闭环已打通：前端提交回测/诊断 → API → Worker → Python CLI → 真实指标 → SSE 推送 → 前端报告显示。
配置读写、策略预览、因子/非因子诊断均已接入主链路。

```

- [ ] **Step 2: 在"模块连接图"前插入"核心契约"小节**

用 Edit 工具，在 `## 模块连接图` 前插入新小节。

old_string:
```

## 模块连接图

```

new_string:
```

## 核心契约

- **策略分类**：`StrategyCategory` 三类（factor_based / non_factor / transitional），`StrategySubcategory` 十值（linear_multi_factor / index_enhancement / ml_nonlinear_factor / trend_cta / arbitrage / hft_microstructure / macro_quant / event_driven / e2e_ai_timeseries / event_sentiment_factor）。Python / API / 前端三层逐字对齐。
- **ConfigSnapshot**：策略配置的唯一真相源，含 schemaVersion / strategy / strategyVersion / category / subcategory / params / hash / updatedAt。任务 payload 强制带 configSnapshot，顶层 params 被拒绝。
- **TaskResultEnvelope**：SSE result 事件顶层含 `resultId` / `resultType`（diagnostics | backtest），完成后可恢复。
- **ResultProcessor 注册表**：API complete handler 通过注册表分派给 BacktestResultProcessor / DiagnosticsResultProcessor，Repo 走 Fastify DI。
- **Preview 契约**：`POST /api/strategies/:name/preview` 仅接受 chart_relevant 字段（非图表字段 422），合并 saved config 后计算。

## 模块连接图

```

- [ ] **Step 3: 更新"已连通链路"代码块**

用 Edit 工具，在已连通链路代码块末尾追加一行。

old_string:
```

apps/web → apps/api → apps/worker → PythonBridge → strategy-runtime CLI
apps/worker → apps/api → SSE → apps/web

```

new_string:
```

apps/web → apps/api → apps/worker → PythonBridge → strategy-runtime CLI
apps/worker → apps/api → SSE → apps/web
apps/api /api/strategies（catalog/config/preview）/api/diagnostics /api/tasks 已对齐 canonical 契约

````

- [ ] **Step 4: 验证改动**

Run: `git diff README.md`
Expected: 仅 3 处改动（核心闭环段落、新增核心契约小节、已连通链路追加一行），无其他段落变动。

- [ ] **Step 5: 提交**

```bash
git add README.md
git commit -m "docs: align README with canonical contract"
````

---

### Task 3: 更新 AGENT.md

**Files:**

- Modify: `AGENT.md:6`（当前阶段）
- Modify: `AGENT.md:49-56`（已知陷阱，追加两条）

**Interfaces:**

- Consumes: 无
- Produces: 无

- [ ] **Step 1: 更新"当前阶段"**

用 Edit 工具替换。

old_string:

```
- 当前阶段：前端研究原型稳定，前后端端到端闭环已打通（前端提交回测 → API → Worker → Python CLI → 真实回测指标 → SSE 推送 → 前端报告显示）。
```

new_string:

```
- 当前阶段：前后端端到端闭环已打通（回测/诊断 → API → Worker → Python CLI → 真实指标 → SSE → 前端展示）。canonical 策略分类、ConfigSnapshot、Preview、Task payload 校验、ResultProcessor 注册表均已落地。历史整合计划见 [contract-realign plan](docs/plans/archive/2026-06-30-contract-realign.md)（已归档）。
```

- [ ] **Step 2: 在"已知陷阱"末尾追加两条**

用 Edit 工具，在已知陷阱最后一条之后追加。

old_string:

```
- `apps/web` 构建时 Vite 会 externalize `node:path` 和 `node:fs`（浏览器兼容性预期行为，不影响运行）。
```

new_string:

```
- `apps/web` 构建时 Vite 会 externalize `node:path` 和 `node:fs`（浏览器兼容性预期行为，不影响运行）。
- ConfigSnapshot 唯一真相源：任务 payload 必须带 configSnapshot，顶层 params 被拒绝（400）。Worker backtest-handler 保留 payload.params fallback 但标记 deprecated。
- ResultProcessor 注册表：API complete handler 通过 registry 分派，BacktestResultProcessor 保存失败会标记任务 failed（不再静默 console.error）。新加任务类型需注册对应 processor。
```

- [ ] **Step 3: 验证改动**

Run: `git diff AGENT.md`
Expected: 仅 2 处改动（当前阶段一行、已知陷阱追加两条），无其他段落变动。

- [ ] **Step 4: 提交**

```bash
git add AGENT.md
git commit -m "docs: update AGENT current phase and pitfalls"
```

---

### Task 4: 更新 AGENTS.md

**Files:**

- Modify: `AGENTS.md:77-100`（类型归属原则代码块，追加新类型）
- Modify: `AGENTS.md:56`（协作接口第一行措辞）

**Interfaces:**

- Consumes: 无
- Produces: 无

- [ ] **Step 1: 在"类型归属原则"代码块末尾追加新类型归属**

用 Edit 工具，在循环引擎类型块之后、代码块结束之前追加。

old_string:

```
循环引擎（loop-engine，Python）拥有：
  LoopType, LoopStatus, IterationStatus,
  LoopConfig, IterationRecord, LoopRecord,
  LoopCondition, LoopSummary
```

new_string:

```
循环引擎（loop-engine，Python）拥有：
  LoopType, LoopStatus, IterationStatus,
  LoopConfig, IterationRecord, LoopRecord,
  LoopCondition, LoopSummary

策略运行时（strategy-runtime，Python）另拥有：
  StrategyCategory, StrategySubcategory（canonical 枚举值，TS 层镜像）

API（apps/api，TypeScript）拥有：
  ConfigSnapshot, ConfigSchemaVersion,
  FactorBasedConfigParams, NonFactorConfigParams, TransitionalConfigParams,
  TaskResultEnvelope, DiagnosticsTaskPayload, BacktestTaskPayload,
  DiagnosticResultWire,
  ResultProcessor, ResultProcessorContext, ResultProcessorOutput
```

- [ ] **Step 2: 更新"协作接口"第一行措辞**

用 Edit 工具替换。

old_string:

```
- 前端 Agent 通过 API Agent 获取策略、任务、报告和数据摘要；当前阶段用前端模拟数据。
- 前端 Agent 通过因子工坊页面展示因子定义、评估结果和因子引用；当前阶段用前端模拟数据。
```

new_string:

```
- 前端 Agent 通过 API Agent 获取策略、任务、报告和数据摘要；当前阶段消费真实 API 数据，部分空态场景仍用 mock 占位。
- 前端 Agent 通过因子工坊页面展示因子定义、评估结果和因子引用；当前阶段用前端模拟数据。
```

- [ ] **Step 3: 验证改动**

Run: `git diff AGENTS.md`
Expected: 仅 2 处改动（类型归属代码块追加、协作接口第一行），第二行（因子工坊）保持不变。

- [ ] **Step 4: 提交**

```bash
git add AGENTS.md
git commit -m "docs: add new type ownership and align collaboration wording"
```

---

## Verification

全部 4 个 Task 完成后：

- [ ] **Step 1: 确认仅 4 个文件改动**

Run: `git log --oneline -4`
Expected: 4 个新 commit，均为 `docs:` 前缀。

- [ ] **Step 2: 确认 CLAUDE.md 已删除**

Run: `git status`
Expected: 工作区干净，CLAUDE.md 不存在。

- [ ] **Step 3: 人工核对**

逐文件 `git diff HEAD~4 -- <file>` 核对：

- README.md：核心闭环 + 核心契约小节 + 已连通链路，无其他段落变动
- AGENT.md：当前阶段 + 已知陷阱两条，无其他段落变动
- AGENTS.md：类型归属追加 + 协作接口第一行，因子工坊行不变
- 无 Phase 6-9 未完成内容被描述为已落地

无需运行 `pnpm test` / `pnpm build`（纯文档改动）。
