# QuantForge 项目阶段总结与后续优化计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 总结项目当前阶段成果，识别已完成的里程碑和遗留问题，规划后续优化方向和执行路径。

**Architecture:** 项目采用 pnpm monorepo + Turborepo 编排，TypeScript 层（IO 密集）+ Python 层（计算密集）双栈架构，通过 Worker 子进程 JSON 协议通信。

**Tech Stack:** React + Vite + CSS Modules（前端）、Fastify（API）、Vitest（TS 测试）、Hatchling + pytest（Python 包）、SQLite + Drizzle ORM（数据存储）、Turborepo（构建编排）

---

## 当前进度

> **最后更新：** 2026-06-17

### 整体进度：部分完成（约 65%）

| Task | 状态 | 说明 |
|------|------|------|
| Task 1: 修复 Python 包依赖方向 | ✅ 已完成 | `strategy-runtime` 的 `dependencies = []`，无循环依赖 |
| Task 2: 前端对接 — 策略列表 | ⚠️ 部分完成 | API 层已搭建，前端有 fallback 机制 |
| Task 3: 前端对接 — 回测运行与任务列表 | ⚠️ 部分完成 | `useResearchWorkflow.ts` 有 API 提交 + fallback |
| Task 4: 前端对接 — 因子工坊 | ⚠️ 部分完成 | `useFactors.ts` 已实现，页面仍用模拟数据 |
| Task 5: 真实数据接入验证 | ✅ 已完成 | baostock 适配器跑通，3 标的 484 bars 入库 |
| Task 6: Python CLI 端到端回测验证 | ✅ 已完成 | 单标的 + 组合策略 CLI 回测均跑通 |
| Task 7: Worker PythonBridge 集成 | ✅ 已完成 | `python-bridge.ts` 有 `streamCall` 流式调用 |
| Task 8: AI 引擎核心流程 | ❌ 未完成 | 仅骨架（features/model/predictor），无真实训练 |
| Task 9: Python 包测试覆盖 | ⚠️ 部分完成 | ai-engine 4 个测试，data-client 1 个测试 |
| Task 10: API 层 build 脚本 | ✅ 已完成 | `build: tsc -p tsconfig.json` |
| Task 11: 持久化任务队列 | ✅ 已完成 | `queue.ts` SQLite 后端已实现 |
| Task 12: 更多策略实现 | ✅ 已完成 | 策略分层（选股/择时/仓位）+ 多策略组合 + CLI 调用已实现 |

### 已完成的关键优化

- Python 包依赖方向修复（strategy-runtime 不再依赖下游包）
- Worker PythonBridge 流式调用（`streamCall` + SSE 推送）
- 持久化任务队列（SQLite 后端，重启不丢失）
- API 层 build 脚本修复
- 策略分层解耦（17 个 Task 全部完成，含选股/择时/仓位/组合/多策略）
- **真实数据闭环已打通**：baostock 采集 → data-center 存储 → Python CLI 读取 → 回测出结果
- **组合策略 CLI 已支持**：通过 `config.components` 配置 selector/timer/sizer，多标的回测验证通过
- **BacktestRunner/MultiSymbolRunner 进度回调**：`run(on_progress=)` 支持流式进度输出

### 未完成的关键项

- 前端未完全对接真实 API（仍依赖模拟数据 fallback）
- AI 引擎仅有骨架，无真实训练流程
- Python 包测试覆盖不足（ai-engine/data-client）
- 策略运行时流式输出已实现但未在前端完整对接
- TS 层 e2e 测试仍用 mock（sql.js WASM 路径问题）

### 后续优先级

1. **前端完全对接 API**（Task 2-4）— 数据闭环已通，可推进
2. **AI 引擎核心流程**（Task 8）— 能力扩展
3. **Python 包测试覆盖**（Task 9）— 质量保障

---

## 一、当前阶段总结

### 1.1 已完成模块

| 模块 | 语言 | 包名 | 测试数 | 状态 |
|------|------|------|--------|------|
| 前端研究原型 | TypeScript | @quant/web | 81 | 稳定运行 |
| HTTP API 入口 | TypeScript | @quant/api | 21 | 已实现 |
| 异步任务 Worker | TypeScript | @quant/worker | 14 | 已实现 |
| 独立数据中心 | TypeScript | @quant/data-center | 43 | 已实现 |
| 数据采集器 | TypeScript | @quant/data-collector | 58 | 已实现 |
| 回测引擎 | Python | quantforge-backtest | 31 | 已实现 |
| 策略运行时 | Python | quantforge-strategy | 5 | 已实现 |
| 因子工坊 | Python | quantforge-factor | 11 | 已实现 |
| AI 引擎 | Python | quantforge-ai | 4 | 骨架已实现 |
| 策略库 | Python | quantforge-strategies | 12 | 已实现 |
| 数据客户端 | Python | quantforge-data | 1 | 已实现 |
| Obsidian 同步 | Python | quantforge-obsidian | 2 | 已实现 |

**总测试数：约 283 个**

### 1.2 基础设施

| 项目 | 状态 |
|------|------|
| pnpm monorepo 工作区 | 已配置，所有模块注册 workspace 包名 |
| Turborepo 并行构建 + 缓存 | 已引入 |
| ESLint flat config + Prettier | 统一工具链已配置 |
| Vitest（TS）+ pytest（Python） | 双栈测试框架就绪 |
| GitHub Actions CI | 已配置（lint/test/build） |
| workspace 依赖协议 | 统一 `workspace:*` |
| 类型归属模型 | 已落地（common 包已移除，类型定义在各所有者模块） |
| Python 包管理 | Hatchling + pyproject.toml，CLI 入口已配置 |

### 1.3 前端成果

- React + TypeScript + Vite + CSS Modules 技术栈稳定
- 三种研究模式（传统量化 / 高频研究 / AI 量化）+ 模式化默认配置
- 内存态研究闭环：运行研究 → 任务中心 → 统一报告
- CSS 视觉系统：Dark Quant Command Center 主题、设计令牌、动效系统
- 中英文本地化（zh.ts / en.ts + UiCopy）
- 自定义 hooks（useLanguage / useResearchWorkflow / useApi / useStrategies / useTasks / useFactors）
- Error Boundary 已集成
- Mock 数据按数据中心 6 子域组织
- API 请求层已搭建（client.ts + 各 API 模块 + Vite proxy）

### 1.4 已有实施计划

| 计划 | 文件 | 状态 |
|------|------|------|
| 前后端对接 | `docs/superpowers/plans/2026-06-16-frontend-backend-integration.md` | 部分执行（API 层已搭建，前端尚未完全对接） |
| Python 引擎重塑 | `docs/superpowers/plans/2026-06-16-python-engine-rewrite.md` | 已完成（Python 包已实现） |
| 真实数据接入与 E2E 验证 | `docs/superpowers/plans/2026-06-16-real-data-ingestion-and-e2e-verification.md` | 部分执行（适配器修复已完成，真实数据拉取待验证） |

---

## 二、遗留问题与技术债

### 2.1 关键遗留

| 编号 | 问题 | 影响 | 优先级 |
|------|------|------|--------|
| P1 | 前端仍使用模拟数据，未对接真实 API | 研究闭环未打通 | 高 |
| P2 | AI 引擎仅有骨架（types + FeatureExtractor + ModelTrainer + AIPredictor），无真实训练流程 | AI 量化模式无法运行 | 高 |
| P3 | 真实数据源未接入（AKShare/Baostock 适配器已写但未实际跑通） | 无真实行情数据 | 高 |
| P4 | Worker 的 PythonBridge 未与真实 Python CLI 集成 | 回测任务无法通过 Worker 触发 | 高 |
| P5 | data-center 仅 SQLite 存储，无 PostgreSQL 实现 | 生产部署受限 | 中 |
| P6 | 无持久化任务队列（当前内存队列重启丢失） | Worker 不可靠 | 中 |

### 2.2 代码质量

| 编号 | 问题 | 影响 | 优先级 |
|------|------|------|--------|
| Q1 | Python 包测试覆盖不足（ai-engine 仅 4 个测试，data-client 仅 1 个测试） | 回归风险高 | 中 |
| Q2 | TS API 层 build 脚本为 `exit 0`（stub 包） | Turborepo 警告，无法产出 dist | 低 |
| Q3 | strategy-runtime 的 pyproject.toml 依赖了所有子包（backtest/factor/ai/strategies/data） | 循环依赖风险 | 中 |
| Q4 | 前端 appData.ts 仍然很大，模拟数据和 API 数据并存 | 维护成本 | 低 |

### 2.3 架构风险

| 编号 | 问题 | 影响 | 优先级 |
|------|------|------|--------|
| A1 | Python 包间依赖方向需要审视（strategy-runtime 依赖了 backtest/factor/ai/strategies） | 违反单向依赖原则 | 中 |
| A2 | 无统一错误码体系（TS 侧和 Python 侧错误码不统一） | 调试困难 | 低 |
| A3 | 无日志/可观测性方案 | 生产问题排查困难 | 低 |

---

## 三、后续优化方向

按优先级排序，分为三个阶段：

### 阶段 A：打通研究闭环（最高优先级）

目标：让"选择策略 → 运行回测 → 查看结果"通过真实数据跑通。

### 阶段 B：质量加固与基础设施

目标：提升测试覆盖、修复架构问题、增强可靠性。

### 阶段 C：能力扩展

目标：AI 引擎落地、更多策略、生产部署准备。

---

## 四、优化任务分解

### Task 1: 修复 Python 包依赖方向

**问题：** strategy-runtime 的 pyproject.toml 依赖了 backtest-engine、factor-lab、ai-engine、strategies、data-client，这违反了 AGENTS.md 定义的依赖白名单。

**正确的依赖方向（按 AGENTS.md）：**
```
strategies → strategy-runtime
backtest-engine → strategy-runtime
factor-lab → strategy-runtime
ai-engine → data-client
data-client → strategy-runtime（re-export 行情类型）
```

strategy-runtime 不应依赖任何下游包。CLI 入口（commands/）需要下游包，应通过延迟导入或拆分 CLI 为独立入口点解决。

**Files:**
- Modify: `packages/strategy-runtime/pyproject.toml`
- Modify: `packages/strategy-runtime/quantforge_strategy/cli.py`

- [ ] **Step 1: 修改 strategy-runtime 的 pyproject.toml 依赖**

将 dependencies 从：
```toml
dependencies = [
    "quantforge-backtest",
    "quantforge-factor",
    "quantforge-ai",
    "quantforge-strategies",
    "quantforge-data",
]
```

改为：
```toml
dependencies = []
```

strategy-runtime 是纯接口/类型包，不应依赖任何下游实现。

- [ ] **Step 2: 修改 CLI 入口使用延迟导入**

修改 `packages/strategy-runtime/quantforge_strategy/cli.py`，将 commands 中的下游包导入改为延迟导入（在函数内部 import），这样 CLI 运行时才需要安装下游包，但 strategy-runtime 本身不声明这些依赖。

- [ ] **Step 3: 运行 strategy-runtime 测试确认通过**

Run: `cd packages/strategy-runtime && python -m pytest tests/ -v`
Expected: 全部通过（strategy-runtime 自身测试不依赖下游包）

- [ ] **Step 4: Commit**

```bash
git add packages/strategy-runtime/pyproject.toml packages/strategy-runtime/quantforge_strategy/cli.py
git commit -m "fix: remove downstream dependencies from strategy-runtime pyproject.toml"
```

---

### Task 2: 前端对接真实 API — 策略列表

**问题：** 前端策略列表仍使用模拟数据，需对接 API 的 GET /api/strategies。

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/hooks/useStrategies.ts`

- [ ] **Step 1: 确认 useStrategies hook 已实现 API 对接逻辑**

读取 `apps/web/src/hooks/useStrategies.ts`，确认其使用 `useApi` + `fetchStrategies`，并有 fallback 到模拟数据的机制。

- [ ] **Step 2: 在 App.tsx 中集成 useStrategies**

修改 `apps/web/src/App.tsx`，导入 `useStrategies`，将 API 返回的策略数据与模拟数据合并，优先使用 API 数据。

- [ ] **Step 3: 启动 API + 前端验证**

Run: `cd apps/api && npx tsx src/index.ts`（终端 1）
Run: `cd apps/web && npm run dev`（终端 2）
Expected: 策略列表显示 API 返回的 dual-ma 和 rsi 策略

- [ ] **Step 4: 运行前端测试**

Run: `cd apps/web && npm test`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/hooks/useStrategies.ts
git commit -m "feat(web): connect strategy list to API with fallback"
```

---

### Task 3: 前端对接真实 API — 回测运行与任务列表

**问题：** 运行回测仍走内存模拟，需对接 Worker 的回测任务提交和结果查询。

**Files:**
- Modify: `apps/web/src/hooks/useResearchWorkflow.ts`
- Modify: `apps/web/src/hooks/useTasks.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/jobs.tsx`

- [ ] **Step 1: 确认 useTasks hook 已实现 submitAndPoll 逻辑**

读取 `apps/web/src/hooks/useTasks.ts`，确认其支持提交回测任务并轮询状态。

- [ ] **Step 2: 修改 useResearchWorkflow 的 handleRunResearch**

在 `handleRunResearch` 中，先尝试通过 API 提交回测任务（submitAndPoll），成功则用真实结果生成报告；失败则 fallback 到模拟数据。

- [ ] **Step 3: 在 App.tsx 中合并 API 任务和本地任务**

将 `apiTasks`（来自 useTasks）与本地 `jobs` 合并展示。

- [ ] **Step 4: 启动全栈验证**

启动 API + Worker + 前端，选择策略 → 运行回测 → 确认任务提交到 API → 查看报告。

- [ ] **Step 5: 运行前端测试**

Run: `cd apps/web && npm test`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/hooks/useResearchWorkflow.ts apps/web/src/hooks/useTasks.ts apps/web/src/App.tsx apps/web/src/components/jobs.tsx
git commit -m "feat(web): connect backtest run and task list to API"
```

---

### Task 4: 前端对接真实 API — 因子工坊

**问题：** 因子工坊页面仍使用模拟数据，需对接 API 的因子 CRUD 和评估触发。

**Files:**
- Modify: `apps/web/src/hooks/useFactors.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/factor-lab.tsx`

- [ ] **Step 1: 确认 useFactors hook 已实现 API 对接逻辑**

读取 `apps/web/src/hooks/useFactors.ts`，确认其使用 `useApi` + `fetchFactors`。

- [ ] **Step 2: 在 App.tsx 中集成 useFactors**

将 API 返回的因子数据传给 FactorLab 组件，优先使用 API 数据。

- [ ] **Step 3: 修改 FactorLab 组件支持评估触发**

在因子评估按钮点击时，调用 `submitFactorEval` API 触发因子评估任务。

- [ ] **Step 4: 运行前端测试**

Run: `cd apps/web && npm test`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useFactors.ts apps/web/src/App.tsx apps/web/src/components/factor-lab.tsx
git commit -m "feat(web): connect factor lab to API with CRUD and eval trigger"
```

---

### Task 5: 真实数据接入验证

**问题：** data-collector 的 AKShare/Baostock 适配器已实现但未实际跑通真实数据拉取。

**Files:**
- Modify: `scripts/seed-data.ts`
- Modify: `scripts/check-baostock.py`

- [ ] **Step 1: 验证 Python 环境和数据源可用**

Run: `python scripts/check-baostock.py`
Expected: 成功拉取茅台日K线数据

- [ ] **Step 2: 运行 seed-data 脚本采集真实数据**

Run: `npx tsx scripts/seed-data.ts`
Expected: 成功写入 data/quant.db

- [ ] **Step 3: 验证数据中心可查询到真实数据**

通过 data-center 的 Provider 查询 600519 日K线，确认数据完整。

- [ ] **Step 4: Commit（如有修复）**

```bash
git add scripts/
git commit -m "fix: verify real data ingestion pipeline"
```

---

### Task 6: Python CLI 端到端回测验证

**问题：** Python CLI 回测链路未经过真实数据验证。

**Files:**
- Modify: `scripts/run-backtest.ts`

- [ ] **Step 1: 安装所有 Python 包**

Run: `cd packages/strategy-runtime && pip install -e . && cd ../backtest-engine && pip install -e . && cd ../data-client && pip install -e . && cd ../strategies && pip install -e .`

- [ ] **Step 2: 用 Python CLI 直接测试回测**

```bash
echo '{"command":"backtest","strategy":"dual_ma","config":{"initialCash":1000000,"slippage":0.001},"dataRange":{"dbPath":"data/quant.db","symbol":"600519","timeframe":"1d"}}' | python -m quantforge_strategy.cli
```

Expected: 输出 BacktestResult JSON

- [ ] **Step 3: 运行端到端回测验证脚本**

Run: `npx tsx scripts/run-backtest.ts`
Expected: 输出回测指标，验证通过

- [ ] **Step 4: Commit（如有修复）**

```bash
git add scripts/run-backtest.ts
git commit -m "fix: verify e2e backtest pipeline with real data"
```

---

### Task 7: Worker PythonBridge 集成验证

**问题：** Worker 的 PythonBridge 未与真实 Python CLI 集成，回测任务无法通过 Worker 触发。

**Files:**
- Modify: `apps/worker/src/python-bridge.ts`
- Modify: `apps/worker/src/handlers/backtest-handler.ts`
- Modify: `apps/worker/tests/e2e-pipeline.test.ts`

- [ ] **Step 1: 确认 PythonBridge 实现正确**

读取 `apps/worker/src/python-bridge.ts`，确认其 spawn Python 子进程并解析 JSON 输出。

- [ ] **Step 2: 修改 BacktestHandler 使用 PythonBridge**

确认 `backtest-handler.ts` 通过 PythonBridge 调用 CLI 回测命令。

- [ ] **Step 3: 运行 Worker E2E 测试**

Run: `cd apps/worker && npx vitest run tests/e2e-pipeline.test.ts`
Expected: 全部通过

- [ ] **Step 4: Commit（如有修复）**

```bash
git add apps/worker/
git commit -m "fix: verify Worker PythonBridge integration with Python CLI"
```

---

### Task 8: AI 引擎核心流程实现

**问题：** AI 引擎仅有骨架，无真实训练流程。

**Files:**
- Modify: `packages/ai-engine/quantforge_ai/features.py`
- Modify: `packages/ai-engine/quantforge_ai/model.py`
- Modify: `packages/ai-engine/quantforge_ai/predictor.py`
- Modify: `packages/ai-engine/tests/test_features.py`
- Modify: `packages/ai-engine/tests/test_model.py`

- [ ] **Step 1: 增强 FeatureExtractor**

实现完整的特征提取流程：收益率特征、波动率特征、成交量特征、技术指标特征。输入为 DataFrame（来自 DataClient），输出为特征矩阵。

- [ ] **Step 2: 增强 ModelTrainer**

实现完整的训练流程：数据分割、模型训练（RandomForest / GradientBoosting）、交叉验证、超参搜索。输出 ModelMetrics。

- [ ] **Step 3: 增强 AIPredictor**

封装特征提取 + 训练 + 预测的统一入口。支持模型持久化（save/load）。

- [ ] **Step 4: 编写测试**

为每个模块编写测试，使用随机数据验证流程正确性。

- [ ] **Step 5: 运行测试**

Run: `cd packages/ai-engine && python -m pytest tests/ -v`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add packages/ai-engine/
git commit -m "feat: implement AI engine core training and prediction pipeline"
```

---

### Task 9: Python 包测试覆盖增强

**问题：** ai-engine 仅 4 个测试，data-client 仅 1 个测试，回归风险高。

**Files:**
- Modify: `packages/ai-engine/tests/`（新增测试文件）
- Modify: `packages/data-client/tests/test_client.py`
- Modify: `packages/factor-lab/tests/`（补充测试）
- Modify: `packages/obsidian-sync/tests/`（补充测试）

- [ ] **Step 1: data-client 测试增强**

新增测试：多标的查询、时间范围过滤、空数据库处理、列名映射验证、DataFrame 输出格式验证。目标：5+ 个测试。

- [ ] **Step 2: ai-engine 测试增强**

新增测试：特征提取各维度验证、模型训练超参验证、预测输出格式验证、模型持久化验证。目标：10+ 个测试。

- [ ] **Step 3: factor-lab 测试增强**

新增测试：因子注册中心完整流程、因子计算引擎批量计算、因子评估调度接口验证。目标：8+ 个测试。

- [ ] **Step 4: obsidian-sync 测试增强**

新增测试：各 builder 输出格式验证、SyncService 同步流程验证。目标：5+ 个测试。

- [ ] **Step 5: 运行全部 Python 测试**

Run: `for d in packages/*/; do echo "=== $d ===" && cd "$d" && python -m pytest tests/ -v --tb=short && cd ../..; done`
Expected: 全部通过

- [ ] **Step 6: Commit**

```bash
git add packages/
git commit -m "test: enhance Python package test coverage"
```

---

### Task 10: API 层 build 脚本修复

**问题：** apps/api 的 build 脚本为 `exit 0`，Turborepo 报 "no output files found" 警告。

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: 修改 API build 脚本**

将 `apps/api/package.json` 的 build 脚本从 `exit 0` 改为 `tsc`，确保类型检查通过。

- [ ] **Step 2: 运行 build 验证**

Run: `cd apps/api && npm run build`
Expected: 类型检查通过，无错误

- [ ] **Step 3: 运行 Turborepo build 验证**

Run: `pnpm build`
Expected: 无 "no output files found" 警告

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json
git commit -m "fix: replace api build stub with tsc type check"
```

---

### Task 11: 持久化任务队列

**问题：** Worker 使用内存队列，重启后任务丢失。

**Files:**
- Modify: `apps/worker/src/queue.ts`
- Modify: `apps/worker/tests/queue.test.ts`

- [ ] **Step 1: 设计持久化方案**

选择 SQLite 作为持久化存储（与 data-center 同栈），定义任务表 schema。

- [ ] **Step 2: 实现 PersistentTaskQueue**

基于 SQLite 实现任务持久化：任务创建时写入 DB，状态变更时更新 DB，重启时从 DB 恢复。

- [ ] **Step 3: 编写测试**

测试：任务创建持久化、状态变更持久化、重启恢复、并发安全。

- [ ] **Step 4: 运行测试**

Run: `cd apps/worker && npx vitest run`
Expected: 全部通过

- [ ] **Step 5: Commit**

```bash
git add apps/worker/
git commit -m "feat: implement persistent task queue with SQLite"
```

---

### Task 12: 更多策略实现

**问题：** 策略库仅有双均线和 RSI 两个策略，覆盖面不足。

**Files:**
- Create: `packages/strategies/quantforge_strategies/bollinger.py`
- Create: `packages/strategies/quantforge_strategies/macd.py`
- Create: `packages/strategies/quantforge_strategies/turtle.py`
- Modify: `packages/strategies/quantforge_strategies/registry.py`
- Create: `packages/strategies/tests/test_bollinger.py`
- Create: `packages/strategies/tests/test_macd.py`
- Create: `packages/strategies/tests/test_turtle.py`

- [ ] **Step 1: 实现布林带策略（BollingerBandStrategy）**

价格突破上轨卖出，突破下轨买入。

- [ ] **Step 2: 实现 MACD 策略（MACDStrategy）**

MACD 金叉买入，死叉卖出。

- [ ] **Step 3: 实现海龟交易策略（TurtleStrategy）**

唐奇安通道突破入场，ATR 止损。

- [ ] **Step 4: 注册到策略注册中心**

在 `registry.py` 中注册新策略，在 `__init__.py` 中自动注册。

- [ ] **Step 5: 编写测试**

每个策略至少 3 个测试：信号生成、持仓更新、回测完整流程。

- [ ] **Step 6: 运行测试**

Run: `cd packages/strategies && python -m pytest tests/ -v`
Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
git add packages/strategies/
git commit -m "feat: add Bollinger, MACD, and Turtle strategies"
```

---

## 五、执行优先级与依赖关系

```
Task 1 (修复 Python 依赖方向)
  ↓
Task 5 (真实数据接入) ← Task 6 (Python CLI E2E 验证)
  ↓
Task 7 (Worker PythonBridge 集成)
  ↓
Task 2 (前端策略对接) ← Task 3 (前端回测对接) ← Task 4 (前端因子对接)
  ↓
Task 8 (AI 引擎实现)
  ↓
Task 9 (测试覆盖增强) ← Task 10 (API build 修复)
  ↓
Task 11 (持久化队列) ← Task 12 (更多策略)
```

**可并行：**
- Task 2/3/4 可与 Task 5/6/7 并行（前端对接不依赖真实数据，有 fallback 机制）
- Task 8 可与 Task 9 并行
- Task 10 可随时执行
- Task 11/12 可并行

---

## 六、里程碑定义

| 里程碑 | 包含任务 | 验收标准 |
|--------|----------|----------|
| M1: 依赖修复 | Task 1 | Python 包依赖方向正确，strategy-runtime 无下游依赖 |
| M2: 数据闭环 | Task 5, 6, 7 | 真实数据写入 SQLite → Python CLI 回测成功 → Worker 集成通过 |
| M3: 前端对接 | Task 2, 3, 4 | 前端策略/任务/因子页面使用 API 数据（有 fallback） |
| M4: AI 落地 | Task 8 | AI 引擎可训练模型并输出预测结果 |
| M5: 质量加固 | Task 9, 10 | Python 测试覆盖 80+，API build 无警告 |
| M6: 可靠性 | Task 11, 12 | 持久化队列 + 5 个策略 |

---

## 七、风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| AKShare/Baostock API 限流或不可用 | 多源优先级回退（已实现 6 个适配器），CSV 适配器兜底 |
| Python 子进程通信不稳定 | PythonBridge 增加超时和重试机制 |
| 前端对接后 API 不可用 | 保留 fallback 到模拟数据机制 |
| strategy-runtime 去依赖后 CLI 无法运行 | CLI 使用延迟导入，运行时才需要下游包 |
| SQLite 并发写入冲突 | data-center 已实现并发安全 close 生命周期 |

---

## 八、不做的事项（当前阶段）

- 不做 PostgreSQL 实现（SQLite 足够当前阶段）
- 不做实盘交易 / 券商连接
- 不做权限系统
- 不做策略市场
- 不做微服务拆分
- 不做日志/可观测性体系（当前阶段用 console.log + 测试覆盖）
- 不做性能优化（当前阶段数据量小，无性能瓶颈）
