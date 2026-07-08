# Backend Sync and Realign Integrated Implementation Plan

> **状态（2026-07-08）：核心已落地，已归档。** canonical 分类 / ConfigSnapshot / Preview / Task payload / ResultProcessor 注册表均已实现并接入主链路（见根 `README.md` 核心契约与 `docs/roadmap.md` 已完成表）。剩余残留：前端 `useResearchWorkflow.ts` 的 ResearchModeId 清理（roadmap 待实施 #3）、Worker 死队列清理。本文件保留作为历史计划参考，不再作为当前执行入口。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `2026-06-29-contract-sync.md` 的产品契约迁移方案与 `2026-06-30-backend-realign-design.md` 的后端结构整理方案合并为一条主线：前后端契约对齐 06-28 目标态，同时清理 API 内部路由碎片、完成回调上帝函数、Repo 注入不一致和 Python 通道漂移。

**Architecture:** 产品契约以 06-29 方案为唯一目标：`StrategyCategory` / `StrategySubcategory`、`ConfigSnapshot`、Preview、Task/SSE、Diagnostics、Worker/Python NDJSON 都按 06-28 目标态收敛。内部结构吸收 06-30 方案：统一 `/api/strategies` 路由所有权，抽出 `ResultProcessor` 注册表，`ReportRepository` 走 Fastify DI，不做 `domains/` / `contracts/` 物理搬迁。落地顺序先止血契约漂移，再整理 API 结构，最后推进完整分类、配置、诊断、回测和前端消费迁移。

**Tech Stack:** React + TypeScript + Vite；Fastify + TypeScript + Drizzle/sql.js；Node Worker + Python subprocess NDJSON；Python `quantforge_strategy` / `quantforge_strategies` / `quantforge_backtest` / `quantforge_factor`；SQLite。

---

## 0. 整合裁决

### 0.1 唯一裁决原则

| 争议                                                           | 裁决                                                                                              |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 产品分类、参数、配置、Preview、Task、Diagnostics 的最终 shape  | 以 06-29 backend-sync 为准                                                                        |
| 后端内部路由、Processor、Repo DI、完成回调拆分                 | 采用 06-30 backend-realign 的结构方案                                                             |
| `apps/api/src/routes/task.ts` 的改动顺序                       | 先定义统一 result envelope，再抽 `ResultProcessor`，再接入 `ConfigSnapshot` 验证和报告/诊断持久化 |
| `StrategyCategory` / `StrategySubcategory` 是否单独走 06-30 P2 | 不单独走；并入本计划 Phase 2 的 canonical taxonomy 迁移                                           |
| Python 通道统一是否单独走 06-30 A4                             | 不单独走；随本计划 Python CLI diagnostics/configSnapshot 改造时收敛                               |
| Worker 死队列清理                                              | 保留为独立收尾任务，不阻塞主链路                                                                  |
| 前端当前旧结构是否作为目标                                     | 不作为目标；当前 `ResearchModeId`、旧 subcategory、mock diagnostics 都视为迁移差距                |

### 0.2 来源方案保留关系

| 原方案内容                                                      | 整合后位置 |
| --------------------------------------------------------------- | ---------- |
| 06-29 Phase 0 diagnostics 算法设计                              | Phase 0    |
| 06-30 P0 `TaskResult` / `DiagnosticResult` / `ApiTaskType` 止血 | Phase 1    |
| 06-30 P1 `/api/strategies` 路由合并、`ResultProcessor`、Repo DI | Phase 1.5  |
| 06-29 Task 1-2 taxonomy / metadata                              | Phase 2    |
| 06-29 Task 3-4 ConfigSnapshot / DB / Repo                       | Phase 3    |
| 06-29 Task 5 Preview                                            | Phase 4    |
| 06-29 Task 6-8 Task / Worker / Python CLI                       | Phase 5    |
| 06-29 Task 9-11 Diagnostics algorithms                          | Phase 6    |
| 06-29 Task 12 Backtest end-to-end                               | Phase 7    |
| 06-29 Task 13 Frontend consumer alignment                       | Phase 8    |
| 06-30 P2/P3 Python channel residual / worker dead queue         | Phase 9    |

---

## 1. Target Product Contract

### 1.1 Canonical taxonomy

```typescript
export type StrategyCategory = 'factor_based' | 'non_factor' | 'transitional';

export type StrategySubcategory =
  | 'linear_multi_factor'
  | 'index_enhancement'
  | 'ml_nonlinear_factor'
  | 'trend_cta'
  | 'arbitrage'
  | 'hft_microstructure'
  | 'macro_quant'
  | 'event_driven'
  | 'e2e_ai_timeseries'
  | 'event_sentiment_factor';
```

旧值处理：

| 当前值                        | 处理                                         |
| ----------------------------- | -------------------------------------------- |
| `nonlinear_ml`                | 自动迁移为 `ml_nonlinear_factor`             |
| `high_frequency`              | 自动迁移为 `hft_microstructure`              |
| `mean_reversion`              | 不静默映射，迁移时 quarantine 或 fail closed |
| `tail_risk_hedging`           | 不静默映射，迁移时 quarantine 或 fail closed |
| 缺失 `index_enhancement`      | 补齐策略元数据与 API 输出                    |
| 缺失 `event_sentiment_factor` | 作为 transitional 唯一目标子分类补齐         |

### 1.2 Strategy wire

API 对前端统一输出 camelCase；Python 和 DB 内部允许 snake_case。

```typescript
export interface StrategyParamDefWire {
  name: string;
  label?: string;
  type: 'int' | 'float' | 'select' | 'bool' | 'slider';
  default: unknown;
  range?: [number, number];
  options?: string[];
  chartRelevant: boolean;
  uiConstraints: UIConstraintWire[];
}

export interface UIConstraintWire {
  kind: 'require_when' | 'disable_when' | 'set_default_when' | 'range_when';
  targetField: string;
  targetValue: unknown;
  actionValue?: unknown;
}

export interface StrategyRowWire {
  name: string;
  category: StrategyCategory;
  subcategory: StrategySubcategory;
  description: string;
  version: string;
  params: StrategyParamDefWire[];
  workflowReady: boolean;
  backtestable: boolean;
  kind?: 'combined' | 'select' | 'timing' | 'position' | 'composite';
  requiredFactors?: string[];
  factorPool?: string;
  summary?: { sharpe: string; return: string; drawdown: string };
}
```

规则：

- `StrategyKind` 只表示执行/组合语义，不参与页面分类。
- Public parameter identity 使用 `name`，旧 `key` 只允许短期 deprecated 输出。
- `workflowReady` 首版规则为：策略已注册 + canonical category/subcategory + 至少一个 active instrument 具备默认 timeframe 的最低 bar 覆盖。

### 1.3 ConfigSnapshot

```typescript
type ConfigSchemaVersion = 1;

interface ConfigSnapshotBase {
  schemaVersion: ConfigSchemaVersion;
  strategy: string;
  strategyVersion: string;
  category: StrategyCategory;
  subcategory: StrategySubcategory;
  params: Record<string, unknown>;
  hash: string;
  updatedAt: number;
}

interface FactorBasedConfigParams {
  factor_pool: string[];
  winsorize: [number, number];
  neutralization: string[];
  standardization: 'zscore' | 'quantile' | 'rank';
  interaction_terms?: boolean;
  max_interaction_order?: number;
}

interface NonFactorConfigParams {
  lookback_window: number;
  hold_period: number;
  indicators: string[];
  indicator_params: Record<string, unknown>;
  dynamic_params: Record<string, unknown>;
}

interface TransitionalConfigParams {
  data_source: string;
  sentiment_decay_half_life: number;
  target_factor_pool: string;
}

type ConfigSnapshot = ConfigSnapshotBase &
  (
    | { category: 'factor_based'; params: FactorBasedConfigParams & Record<string, unknown> }
    | { category: 'non_factor'; params: NonFactorConfigParams & Record<string, unknown> }
    | {
        category: 'transitional';
        subcategory: 'event_sentiment_factor';
        params: TransitionalConfigParams & Record<string, unknown>;
      }
  );
```

Config API：

```typescript
// GET /api/strategies/:name/config
interface GetConfigResponse {
  persisted: boolean;
  configSnapshot: ConfigSnapshot;
}

// PUT /api/strategies/:name/config
interface PutConfigRequest {
  category: StrategyCategory;
  subcategory: StrategySubcategory;
  params: Record<string, unknown>;
  expectedHash?: string;
}

interface PutConfigResponse {
  saved: true;
  configSnapshot: ConfigSnapshot;
}
```

规则：

- Task payload 不允许顶层 `params` 与 `configSnapshot` 并存。
- `GET` 无保存配置时返回 `200 { persisted:false, configSnapshot: defaults }`。
- 已有配置时客户端省略 `expectedHash` 返回 409；首存可以省略。
- 旧 `{ config }` body 只允许短期兼容输入，输出以 `configSnapshot` 为准。

### 1.4 Preview API

```typescript
interface PreviewRequest {
  symbol: string;
  timeframe: string;
  cursor: number | null;
  limit?: number;
  preview_params: Record<string, unknown>;
}

interface PreviewResponse {
  symbol: string;
  bars: Array<{ ts: number; o: number; h: number; l: number; c: number; v: number }>;
  overlays: Array<
    | {
        type: 'line';
        label: string;
        data: Array<{ ts: number; value: number }>;
        style?: { color?: string; width?: number };
      }
    | { type: 'marker'; label: string; data: Array<{ ts: number; kind: string; value?: number }> }
    | { type: 'histogram'; label: string; data: Array<{ ts: number; value: number }> }
  >;
  signals: Array<{
    ts: number;
    side: 'buy' | 'sell';
    price: number;
    reason: string;
    factor_snapshot: Record<string, number> | null;
  }>;
  pagination: { has_more: boolean; next_cursor: number | null; total_count: number | null };
  fingerprint: string;
  engine_version: string;
}
```

规则：

- Preview 是 API 内纯 TypeScript 轻量引擎，不调用 Python。
- `preview_params` 只接受 `chartRelevant=true` 字段；非 chart-relevant 字段返回 422。
- 后端严格输出 `{ts,o,h,l,c,v}`，不输出双 shape；前端在 Phase 8 适配。

### 1.5 Task, SSE, Diagnostics

```typescript
interface DiagnosticsTaskPayload {
  strategy: string;
  symbol: string;
  timeframe: string;
  startTs?: number;
  endTs?: number;
  configSnapshot: ConfigSnapshot;
}

interface BacktestTaskPayload {
  strategy: string;
  symbol: string;
  timeframe: string;
  initialCash: number;
  slippage: number;
  startTs?: number;
  endTs?: number;
  configSnapshot: ConfigSnapshot;
}

type TaskResultEnvelope =
  | {
      type: 'result';
      taskId: string;
      resultId: string;
      resultType: 'diagnostics';
      data: DiagnosticResultData;
    }
  | {
      type: 'result';
      taskId: string;
      resultId: string;
      resultType: 'backtest';
      data: BacktestTaskResult;
    };

interface DiagnosticResultWire {
  resultId: string;
  resultType: 'diagnostics';
  taskId: string;
  strategy: string;
  category: StrategyCategory;
  subcategory: StrategySubcategory;
  configSnapshot: ConfigSnapshot;
  data: FactorDiagnosticsResult | NonFactorDiagnosticsResult | TransitionalDiagnosticsResult;
  createdAt: number;
  expiresAt: number;
  engineVersion: string;
}
```

规则：

- SSE `result` 事件顶层必须含 `resultId/resultType`。
- diagnostics/backtest 完成后必须有可恢复结果 ID。
- Python backtest 成功但报告持久化失败时，任务失败。
- Synthetic diagnostics 默认关闭；开发模式如果启用，响应必须包含 `synthetic:true`。

---

## 2. Target Internal Structure

### 2.1 API structure

保留现有目录树，不做 `domains/`、`platform/`、`contracts/` 物理搬迁。

```text
apps/api/src/routes/
  strategy.ts          -> catalog/config/preview 的单一注册入口
  task.ts              -> task submit/stream/internal/pending/complete 薄路由
  diagnostics.ts       -> diagnostics result query

apps/api/src/services/
  config-service.ts
  diagnostic-service.ts
  preview-service.ts
  result-processors/
    index.ts
    types.ts
    backtest-result-processor.ts
    diagnostics-result-processor.ts

apps/api/src/repositories/
  sqlite-config-repo.ts
  sqlite-diag-repo.ts
  sqlite-report-repo.ts
```

### 2.2 ResultProcessor boundary

```typescript
export interface ResultProcessorContext {
  task: TaskRecord;
  result: unknown;
}

export interface ResultProcessorOutput {
  resultId: string;
  resultType: 'backtest' | 'diagnostics';
  data: Record<string, unknown>;
}

export interface ResultProcessor {
  type: 'backtest' | 'diagnostics';
  process(ctx: ResultProcessorContext): Promise<ResultProcessorOutput>;
}
```

规则：

- `routes/task.ts` 的 complete handler 只做：读取 task、标记完成、调用 processor、写 SSE result。
- `BacktestResultProcessor` 负责报告映射、AI analysis 合并、surrogate 清洗、report 保存。
- `DiagnosticsResultProcessor` 负责 diagnostics 保存、resultId/resultType 构造。
- `ReportRepository`、`DiagnosticRepository`、`ConfigRepository` 都通过 `app.decorate` 注入，不在 route handler 里 `new`。

### 2.3 Python bridge boundary

- Worker 继续使用 `PythonBridge.streamCall` + NDJSON。
- API catalog 当前可保留现状，Phase 9 再将策略元数据查询收敛到 CLI `listStrategies`。
- CLI diagnostics/backtest 入口在 Phase 5 先完成，因为这是主链路。

---

## 3. File Map

### 3.1 API

| File                                                                      | Responsibility                                                   |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `apps/api/src/types.ts`                                                   | Canonical TS 镜像类型、Task payload/result、DiagnosticResultWire |
| `apps/api/src/routes/strategy.ts`                                         | `/api/strategies` catalog/config/preview 单一入口                |
| `apps/api/src/routes/config.ts`                                           | 整合后删除注册或转为 strategy route 内部模块                     |
| `apps/api/src/routes/preview.ts`                                          | 整合后删除注册或转为 strategy route 内部模块                     |
| `apps/api/src/routes/task.ts`                                             | task submit/stream/internal complete 薄路由                      |
| `apps/api/src/routes/diagnostics.ts`                                      | diagnostics result query                                         |
| `apps/api/src/services/config-service.ts`                                 | 默认 configSnapshot、hash、校验、保存                            |
| `apps/api/src/services/diagnostic-service.ts`                             | diagnostics save/query/purge                                     |
| `apps/api/src/services/preview-service.ts`                                | 纯 TS preview                                                    |
| `apps/api/src/services/result-processors/types.ts`                        | ResultProcessor 接口                                             |
| `apps/api/src/services/result-processors/backtest-result-processor.ts`    | backtest 结果持久化与信封输出                                    |
| `apps/api/src/services/result-processors/diagnostics-result-processor.ts` | diagnostics 结果持久化与信封输出                                 |
| `apps/api/src/services/result-processors/index.ts`                        | processor registry                                               |
| `apps/api/src/storage/schema.ts`                                          | config/diagnostic/report schema                                  |
| `apps/api/src/storage/connection.ts`                                      | SQLite schema migration/bootstrap                                |
| `apps/api/src/repositories/sqlite-config-repo.ts`                         | ConfigSnapshot repo                                              |
| `apps/api/src/repositories/sqlite-diag-repo.ts`                           | DiagnosticResult repo                                            |
| `apps/api/src/repositories/sqlite-report-repo.ts`                         | Report repo                                                      |

### 3.2 Worker

| File                                              | Responsibility                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------- |
| `apps/worker/src/types.ts`                        | Task payload mirrors、Python request/response                                   |
| `apps/worker/src/main.ts`                         | task type routing；unsupported types fail before polling or are rejected by API |
| `apps/worker/src/handlers/diagnostics-handler.ts` | Build diagnostics CLI request from configSnapshot                               |
| `apps/worker/src/handlers/backtest-handler.ts`    | Build backtest CLI request from configSnapshot                                  |
| `apps/worker/src/queue.ts`                        | Phase 9 删除，当前主链路不使用                                                  |

### 3.3 Python

| File                                                                                 | Responsibility                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `packages/strategy-runtime/quantforge_strategy/types.py`                             | StrategyCategory/Subcategory/ParamDef canonical |
| `packages/strategy-runtime/quantforge_strategy/meta.py`                              | StrategyMeta / StrategyParamDef                 |
| `packages/strategy-runtime/quantforge_strategy/cli.py`                               | Register `backtest` and `diagnostics` commands  |
| `packages/strategy-runtime/quantforge_strategy/commands/backtest.py`                 | Read `configSnapshot.params`                    |
| `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`              | Dispatch diagnostics by category/subcategory    |
| `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/factor.py`       | factor_based diagnostics                        |
| `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/non_factor.py`   | non_factor diagnostics                          |
| `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/transitional.py` | event_sentiment_factor diagnostics              |
| `packages/strategies/**`                                                             | Strategy metadata classification completion     |

### 3.4 Frontend

| File                                         | Responsibility                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/web/src/data/types.ts`                 | Target type mirrors                                                       |
| `apps/web/src/hooks/useStrategies.ts`        | Consume camelCase strategy wire                                           |
| `apps/web/src/api/strategies.ts`             | Strategy API types                                                        |
| `apps/web/src/api/strategies-config.ts`      | ConfigSnapshot API types                                                  |
| `apps/web/src/api/preview.ts`                | Preview API types                                                         |
| `apps/web/src/api/tasks.ts`                  | Task payload/result/SSE types                                             |
| `apps/web/src/api/diagnostics.ts`            | DiagnosticResultWire API                                                  |
| `apps/web/src/components/config-panel.tsx`   | Save flattened params and expectedHash                                    |
| `apps/web/src/components/workspace-page.tsx` | Load configSnapshot, submit diagnostics/backtest, render real diagnostics |
| `apps/web/src/components/kline-chart.tsx`    | Consume target preview shape or local adapter                             |

---

## 4. Phased Implementation

### Phase 0: Diagnostics Algorithm Contract Freeze

**Goal:** 在写 Python diagnostics 前冻结三类诊断的输入、输出、错误和最小算法规则。

**Files:**

- Create: `docs/specs/2026-06-30-diagnostics-algorithm-contract.md`

**Acceptance Criteria:**

- 文档定义 `FactorDiagnosticsResult`、`NonFactorDiagnosticsResult`、`TransitionalDiagnosticsResult`。
- 文档定义 `NO_PRICE_DATA`、`NO_FACTOR_DATA`、`NO_EVENT_SENTIMENT_DATA`、`INVALID_CONFIG_SNAPSHOT`。
- 文档定义数据输入来源：price bars、factor values、event/sentiment records。
- 文档明确 synthetic diagnostics 默认关闭。

**Steps:**

- [ ] 写明 factor_based 的 IC/rankIC、分层收益、相关性矩阵字段。
- [ ] 写明 non_factor 的参数敏感性、信号质量、滑点压力字段。
- [ ] 写明 transitional 的情感衰减、映射目标、标准化因子质量、映射验证字段。
- [ ] 运行一次人工自审，确认没有 `TBD`、`TODO`、互相矛盾的字段名。
- [ ] Commit: `docs: define diagnostics algorithm contract`。

---

### Phase 1: Contract Stop-Bleed from 06-30 P0

**Goal:** 先修当前前后端最明显的契约漂移，但字段 shape 直接采用本计划目标契约。

#### Task 1.1: Define TaskResult envelope and diagnostics task type

**Files:**

- Modify: `apps/api/src/types.ts`
- Modify: `apps/web/src/api/tasks.ts`
- Modify/Create: `apps/api/tests/routes/task.test.ts`
- Modify/Create: `apps/web/tests/use-tasks.test.ts`

**Acceptance Criteria:**

- API 与前端类型都包含 `diagnostics` task type。
- `TaskStreamEvent` 支持顶层 `resultId/resultType`。
- `TaskResultEnvelope` 是可辨识联合：`diagnostics` 与 `backtest` 分支清晰。
- 旧 `event.data.resultId` 的解析仅作为短期兼容路径存在。

**Steps:**

- [ ] 在 API types 中增加 `TaskResultEnvelope`、`DiagnosticsTaskPayload`、`BacktestTaskPayload`。
- [ ] 在前端 `ApiTaskType` 中加入 `diagnostics`。
- [ ] 在前端 `TaskStreamEvent` 顶层加入 `resultId?: string`、`resultType?: 'diagnostics' | 'backtest'`。
- [ ] 添加 API route test：complete diagnostics 时 SSE payload 顶层有 `resultId/resultType`。
- [ ] 添加前端 task stream test：`resultType === 'diagnostics'` 时走 diagnostics 分支。
- [ ] Run: `cd apps/api && pnpm test -- tests/routes/task.test.ts`。
- [ ] Run: `cd apps/web && pnpm test -- tests/use-tasks.test.ts`。
- [ ] Commit: `feat: define typed task result envelope`。

#### Task 1.2: Align DiagnosticResult wire shape

**Files:**

- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/routes/diagnostics.ts`
- Modify: `apps/api/src/repositories/sqlite-diag-repo.ts`
- Modify: `apps/web/src/data/types.ts`
- Modify: `apps/web/src/api/diagnostics.ts`
- Modify/Create: `apps/api/tests/routes/diagnostics.test.ts`

**Acceptance Criteria:**

- `GET /api/diagnostics/:resultId` 返回 `resultId/resultType/taskId/strategy/category/subcategory/configSnapshot/data/createdAt/expiresAt/engineVersion`。
- 前端不再只依赖 `id/dataJson`。
- 短期兼容旧 rows 时，repo mapper 将 `id` 映射为 `resultId`，`dataJson` 映射为 `data`。

**Steps:**

- [ ] 更新 API `DiagnosticResultWire` 类型。
- [ ] 更新 diagnostics route response mapper。
- [ ] 更新 sqlite diag repo read/write mapper。
- [ ] 更新前端 `DiagnosticResult` 类型和 `fetchDiagnostic` 返回类型。
- [ ] 添加 route test 覆盖新 shape。
- [ ] Run: `cd apps/api && pnpm test -- tests/routes/diagnostics.test.ts`。
- [ ] Run: `cd apps/web && pnpm test`。
- [ ] Commit: `feat: align diagnostics result wire shape`。

---

### Phase 1.5: Backend Internal Realign from 06-30 P1

**Goal:** 在不改变 public contract 的前提下，清理 API 内部结构，避免后续 06-29 主线继续堆进上帝函数。

#### Task 1.5.1: Consolidate `/api/strategies` route ownership

**Files:**

- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/strategy.ts`
- Modify: `apps/api/src/routes/config.ts`
- Modify: `apps/api/src/routes/preview.ts`
- Modify/Create: `apps/api/tests/routes/strategy.test.ts`
- Modify/Create: `apps/api/tests/routes/config.test.ts`
- Modify/Create: `apps/api/tests/routes/preview.test.ts`

**Acceptance Criteria:**

- `app.ts` 对 `/api/strategies` 只 register 一次。
- 原 `/api/strategies`、`/api/strategies/:name/config`、`/api/strategies/:name/preview` URL 不变。
- route 文件内部可以拆 helper，但 public registration 只有 strategy route 拥有。
- 所有现有 strategy/config/preview route tests 通过。

**Steps:**

- [ ] 将 config route handler 逻辑移入 `routes/strategy.ts` 或由 `strategy.ts` 调用内部 register function。
- [ ] 将 preview route handler 逻辑移入 `routes/strategy.ts` 或由 `strategy.ts` 调用内部 register function。
- [ ] 删除 `app.ts` 中对 config/preview route 的独立 register。
- [ ] 添加测试确认三个 endpoint URL 保持不变。
- [ ] Run: `cd apps/api && pnpm test -- tests/routes/strategy.test.ts tests/routes/config.test.ts tests/routes/preview.test.ts`。
- [ ] Commit: `refactor: consolidate strategy route ownership`。

#### Task 1.5.2: Introduce ResultProcessor registry and DI repos

**Files:**

- Create: `apps/api/src/services/result-processors/types.ts`
- Create: `apps/api/src/services/result-processors/index.ts`
- Create: `apps/api/src/services/result-processors/backtest-result-processor.ts`
- Create: `apps/api/src/services/result-processors/diagnostics-result-processor.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/routes/task.ts`
- Modify: `apps/api/src/repositories/sqlite-report-repo.ts`
- Modify/Create: `apps/api/tests/routes/task.test.ts`
- Create/Modify: `apps/api/tests/services/result-processors.test.ts`

**Acceptance Criteria:**

- `routes/task.ts` complete handler 只负责 task 状态流转和 processor 分派。
- `BacktestResultProcessor` 负责 report save、report mapper、AI analysis merge、surrogate cleanup。
- `DiagnosticsResultProcessor` 负责 diagnostics save 和 result envelope。
- `ReportRepository` 不在 route handler 内 `new`。
- complete handler 主逻辑保持在 25 行左右；如果多于 25 行，测试不强制失败，但需要拆出私有 helper。

**Steps:**

- [ ] 定义 `ResultProcessor`、`ResultProcessorContext`、`ResultProcessorOutput`。
- [ ] 实现 `createResultProcessorRegistry()`。
- [ ] 把 backtest 完成后的报告保存逻辑移到 `BacktestResultProcessor`。
- [ ] 把 diagnostics 完成后的诊断保存逻辑移到 `DiagnosticsResultProcessor`。
- [ ] 在 `app.ts` decorate repositories 和 processor registry。
- [ ] 修改 `routes/task.ts` complete handler 调用 registry。
- [ ] 添加 unit test 覆盖 backtest/diagnostics processor 输出 `resultId/resultType`。
- [ ] Run: `cd apps/api && pnpm test -- tests/routes/task.test.ts tests/services/result-processors.test.ts`。
- [ ] Commit: `refactor: extract task result processors`。

---

### Phase 2: Canonical Strategy Taxonomy and Metadata

**Goal:** 让 Python registry 和 API `/api/strategies` 只输出 06-28 canonical category/subcategory 和 target parameter wire shape。

**Files:**

- Modify: `packages/strategy-runtime/quantforge_strategy/types.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/meta.py`
- Modify: `packages/strategies/**`
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/routes/strategy.ts`
- Modify/Create: `packages/strategy-runtime/tests/test_strategy_meta.py`
- Modify/Create: `apps/api/tests/routes/strategy.test.ts`

**Acceptance Criteria:**

- Python `StrategySubcategory` 只包含目标 10 值。
- API `StrategySubcategory` type 只包含目标 10 值。
- API output public param identity 使用 `name`。
- API output public wire 使用 `chartRelevant/uiConstraints/targetField/targetValue/actionValue`。
- `workflowReady` 使用注册策略 + canonical category/subcategory + 数据覆盖，不再用 `subcategory !== null`。
- `mean_reversion`、`tail_risk_hedging` 不作为 API output。

**Steps:**

- [ ] 更新 Python enum。
- [ ] 更新 Python `StrategyParamDef`：`key` 迁移为 `name`，`range` 替代 `min/max` 的 public wire。
- [ ] 补齐每个实际注册策略的 category/subcategory。
- [ ] 将 `nonlinear_ml` 改为 `ml_nonlinear_factor`。
- [ ] 将 `high_frequency` 改为 `hft_microstructure`。
- [ ] 给 `index_enhancement` 和 `event_sentiment_factor` 补元数据入口。
- [ ] API route mapper 输出 camelCase wire。
- [ ] 添加 Python tests 覆盖 enum 和 meta。
- [ ] 添加 API tests 覆盖 strategy list wire shape。
- [ ] Run: `cd packages/strategy-runtime && pytest tests/test_strategy_meta.py -v`。
- [ ] Run: `cd apps/api && pnpm test -- tests/routes/strategy.test.ts`。
- [ ] Commit: `feat: align strategy taxonomy contract`。

---

### Phase 3: ConfigSnapshot, Config API, DB, and Repositories

#### Task 3.1: Implement ConfigSnapshot service and API

**Files:**

- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/services/config-service.ts`
- Modify: `apps/api/src/routes/strategy.ts`
- Modify/Create: `apps/api/tests/services/config-service.test.ts`
- Modify/Create: `apps/api/tests/routes/config.test.ts`

**Acceptance Criteria:**

- `GET /api/strategies/:name/config` 返回 `{ persisted, configSnapshot }`。
- 无保存配置时返回 defaults，不返回 404/null。
- `PUT /api/strategies/:name/config` 请求使用 `{ category, subcategory, params, expectedHash }`。
- 服务端校验 category/subcategory 与 registry meta 一致。
- 保存成功返回完整 `configSnapshot`。
- hash 冲突返回 409 和 current snapshot。

**Steps:**

- [ ] 在 API types 定义 `ConfigSnapshot` 和三类 params。
- [ ] 实现 default snapshot builder。
- [ ] 实现 canonical JSON hash。
- [ ] 实现 PUT validation。
- [ ] 更新 route handler。
- [ ] 添加 service tests 覆盖 default、save、hash conflict。
- [ ] 添加 route tests 覆盖 GET/PUT。
- [ ] Run: `cd apps/api && pnpm test -- tests/services/config-service.test.ts tests/routes/config.test.ts`。
- [ ] Commit: `feat: implement config snapshot api`。

#### Task 3.2: Update DB schema and repositories

**Files:**

- Modify: `apps/api/src/storage/schema.ts`
- Modify: `apps/api/src/storage/connection.ts`
- Modify: `apps/api/src/repositories/sqlite-config-repo.ts`
- Modify: `apps/api/src/repositories/sqlite-diag-repo.ts`
- Modify/Create: `apps/api/tests/storage/schema.test.ts`
- Modify/Create: `apps/api/tests/repositories/config-repo.test.ts`
- Modify/Create: `apps/api/tests/repositories/diagnostic-repo.test.ts`

**Acceptance Criteria:**

- `strategy_configs` 支持 strategyName、category、subcategory、schemaVersion、configJson、hash、updatedAt。
- `config_history` 记录每次成功保存。
- `diagnostic_results` 支持 resultId/resultType/category/subcategory/configSnapshot/dataJson/engineVersion/expiresAt。
- 旧 rows 可被 mapper 读取成新 wire shape。
- migration 对 `mean_reversion` / `tail_risk_hedging` fail closed 或 quarantine。

**Steps:**

- [ ] 更新 Drizzle schema。
- [ ] 更新 bootstrap SQL。
- [ ] 更新 config repo get/save/history。
- [ ] 更新 diagnostics repo save/get/list。
- [ ] 添加 storage tests 覆盖 schema 字段。
- [ ] 添加 repo tests 覆盖保存和读取。
- [ ] Run: `cd apps/api && pnpm test -- tests/storage/schema.test.ts tests/repositories/config-repo.test.ts tests/repositories/diagnostic-repo.test.ts`。
- [ ] Commit: `feat: persist config and diagnostics snapshots`。

---

### Phase 4: Preview Target Contract

**Goal:** `POST /api/strategies/:name/preview` 对齐 target response shape，并按 category/subcategory/config 选择轻量 preview 逻辑。

**Files:**

- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/services/preview-service.ts`
- Modify: `apps/api/src/routes/strategy.ts`
- Modify/Create: `apps/api/tests/services/preview-service.test.ts`
- Modify/Create: `apps/api/tests/routes/preview.test.ts`

**Acceptance Criteria:**

- Response bars 使用 `{ts,o,h,l,c,v}`。
- Response 含 overlays/signals/pagination/fingerprint/engine_version。
- Route 使用 `:name` 查 strategy meta。
- 非 chart-relevant 参数返回 422。
- PreviewService 合并 saved/default configSnapshot 与 preview_params。
- Preview 不调用 Python。

**Steps:**

- [ ] 更新 Preview request/response types。
- [ ] 更新 route validation。
- [ ] 更新 PreviewService bar mapper。
- [ ] 实现 factor_based preview output。
- [ ] 实现 non_factor preview output。
- [ ] 实现 transitional preview output。
- [ ] 添加 service tests 覆盖三类 preview。
- [ ] 添加 route test 覆盖 422。
- [ ] Run: `cd apps/api && pnpm test -- tests/services/preview-service.test.ts tests/routes/preview.test.ts`。
- [ ] Commit: `feat: align preview api with strategy contract`。

---

### Phase 5: Task, Worker, and Python CLI Contract

#### Task 5.1: Enforce ConfigSnapshot-only task payloads in API

**Files:**

- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/routes/task.ts`
- Modify/Create: `apps/api/tests/routes/task.test.ts`

**Acceptance Criteria:**

- diagnostics/backtest task payload 必须包含 `configSnapshot`。
- 顶层 `payload.params` 被拒绝。
- `payload.strategy === payload.configSnapshot.strategy`。
- `payload.configSnapshot.category/subcategory` 必须 canonical。
- `factor_compute/factor_eval/ai_train` 在本主线中显式 rejected，除非后续单独扩展。

**Steps:**

- [ ] 添加 task payload validation helper。
- [ ] 在 POST `/api/tasks` 调用 validation。
- [ ] 添加 tests 覆盖缺失 configSnapshot、顶层 params、strategy mismatch、unsupported task type。
- [ ] Run: `cd apps/api && pnpm test -- tests/routes/task.test.ts`。
- [ ] Commit: `feat: validate config snapshot task payloads`。

#### Task 5.2: Update Worker handlers to pass ConfigSnapshot and fail closed

**Files:**

- Modify: `apps/worker/src/types.ts`
- Modify: `apps/worker/src/handlers/diagnostics-handler.ts`
- Modify: `apps/worker/src/handlers/backtest-handler.ts`
- Modify: `apps/worker/src/main.ts`
- Modify/Create: `apps/worker/tests/diagnostics-handler.test.ts`
- Modify/Create: `apps/worker/tests/backtest-handler.test.ts`

**Acceptance Criteria:**

- Diagnostics handler 传 `configSnapshot`、`dataRange`，不传 legacy `config.strategyParams`。
- Backtest handler 不读取 `payload.params` fallback。
- diagnostics `UNKNOWN_COMMAND` 或 `{ok:false}` 标记任务失败，不再 echo success。
- Worker task type surface 与 API validation 一致。

**Steps:**

- [ ] 更新 worker task payload types。
- [ ] 重写 diagnostics request builder。
- [ ] 删除 diagnostics echo fallback。
- [ ] 重写 backtest request builder。
- [ ] 更新 main task type routing。
- [ ] 添加 tests 捕获 PythonBridge request shape。
- [ ] Run: `cd apps/worker && pnpm test -- tests/diagnostics-handler.test.ts tests/backtest-handler.test.ts`。
- [ ] Commit: `feat: pass config snapshots through worker bridge`。

#### Task 5.3: Add Python CLI diagnostics and configSnapshot backtest support

**Files:**

- Modify: `packages/strategy-runtime/quantforge_strategy/cli.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/backtest.py`
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/__init__.py`
- Modify/Create: `packages/strategy-runtime/tests/test_cli.py`
- Create: `packages/strategy-runtime/tests/test_diagnostics_command.py`
- Modify/Create: `packages/strategy-runtime/tests/test_backtest_command_market_rules.py`

**Acceptance Criteria:**

- `_COMMANDS` 包含 `diagnostics`。
- `backtest.py` 从 `configSnapshot.params` 构造策略参数。
- `diagnostics.py` 按 `configSnapshot.category/subcategory` dispatch。
- Unknown category/subcategory 返回 `INVALID_CONFIG_SNAPSHOT` error event。
- stdout 只输出 NDJSON。

**Steps:**

- [ ] 注册 CLI diagnostics command。
- [ ] 添加 configSnapshot/dataRange/execution request parser。
- [ ] 更新 backtest command。
- [ ] 创建 diagnostics dispatcher。
- [ ] 添加 CLI tests。
- [ ] Run: `cd packages/strategy-runtime && pytest tests/test_cli.py tests/test_diagnostics_command.py tests/test_backtest_command_market_rules.py -v`。
- [ ] Commit: `feat: add diagnostics cli contract`。

---

### Phase 6: Python Diagnostics Algorithms

#### Task 6.1: Implement factor_based diagnostics

**Files:**

- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/factor.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Create/Modify: `packages/strategy-runtime/tests/test_diagnostics_factor.py`

**Acceptance Criteria:**

- 输出 IC/rankIC 序列。
- 输出分层收益。
- 输出因子相关性矩阵。
- 缺 price/factor data 返回结构化错误。

**Steps:**

- [ ] 实现 price/factor data loading adapter。
- [ ] 实现 forward returns。
- [ ] 实现 IC/rankIC。
- [ ] 实现 layered returns。
- [ ] 实现 correlation matrix。
- [ ] 添加 deterministic tests。
- [ ] Run: `cd packages/strategy-runtime && pytest tests/test_diagnostics_factor.py -v`。
- [ ] Commit: `feat: implement factor diagnostics`。

#### Task 6.2: Implement non_factor diagnostics

**Files:**

- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/non_factor.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Create/Modify: `packages/strategy-runtime/tests/test_diagnostics_non_factor.py`

**Acceptance Criteria:**

- 输出参数敏感性。
- 输出信号质量。
- 输出滑点压力测试。
- 策略不能生成信号时返回结构化错误。

**Steps:**

- [ ] 实现 parameter grid generation。
- [ ] 实现 simplified backtest/signal adapter。
- [ ] 实现 signal quality statistics。
- [ ] 实现 slippage stress loop。
- [ ] 添加 trend_cta fixture tests。
- [ ] Run: `cd packages/strategy-runtime && pytest tests/test_diagnostics_non_factor.py -v`。
- [ ] Commit: `feat: implement non-factor diagnostics`。

#### Task 6.3: Implement transitional/event_sentiment_factor diagnostics

**Files:**

- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/transitional.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Create/Modify: `packages/strategy-runtime/tests/test_diagnostics_transitional.py`

**Acceptance Criteria:**

- 输出 sentiment decay curve。
- 输出 mapping target metrics。
- 输出 standardized factor quality。
- 输出 mapping validation checks。
- 无 event/sentiment data 返回 `NO_EVENT_SENTIMENT_DATA`。

**Steps:**

- [ ] 实现 sentiment event loading adapter。
- [ ] 实现 exponential decay scoring。
- [ ] 实现 standardization/outlier checks。
- [ ] 实现 target factor mapping metrics。
- [ ] 实现 mapping validation checks。
- [ ] 添加 deterministic tests。
- [ ] Run: `cd packages/strategy-runtime && pytest tests/test_diagnostics_transitional.py -v`。
- [ ] Commit: `feat: implement event sentiment diagnostics`。

---

### Phase 7: Backtest End-to-End Contract and Report Result IDs

**Goal:** 回测任务从 API 到 Worker 到 Python 到 report persistence 全链路只使用 `configSnapshot`，并返回可恢复 report resultId。

**Files:**

- Modify: `apps/api/src/routes/task.ts`
- Modify: `apps/api/src/services/result-processors/backtest-result-processor.ts`
- Modify: `apps/api/src/services/report-mapper.ts`
- Modify: `apps/worker/src/handlers/backtest-handler.ts`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/backtest.py`
- Modify/Create: `apps/api/tests/routes/report.test.ts`
- Modify/Create: `apps/worker/tests/backtest-handler.test.ts`
- Modify/Create: `packages/strategy-runtime/tests/test_backtest_command_market_rules.py`

**Acceptance Criteria:**

- Backtest handler 无 `payload.params` fallback。
- Python backtest 从 `configSnapshot.params` 构造策略。
- Report mapper 保存 config snapshot metadata。
- SSE result 顶层含 `resultId/resultType='backtest'`。
- Report save failure 导致 task failed。

**Steps:**

- [ ] 移除 backtest API tests 中的顶层 params。
- [ ] 确认 Worker request 包含 configSnapshot 和 execution fields。
- [ ] 确认 Python command 使用 configSnapshot.params。
- [ ] 在 `BacktestResultProcessor` 中先保存 report，再发 result envelope。
- [ ] 添加 report resultId tests。
- [ ] Run: `cd apps/api && pnpm test -- tests/routes/report.test.ts tests/routes/task.test.ts`。
- [ ] Run: `cd apps/worker && pnpm test -- tests/backtest-handler.test.ts`。
- [ ] Run: `cd packages/strategy-runtime && pytest tests/test_backtest_command_market_rules.py -v`。
- [ ] Commit: `feat: use config snapshots for backtest tasks`。

---

### Phase 8: Frontend Consumer Alignment

**Goal:** 前端只作为消费方对接新后端 contract，不再把旧 taxonomy、ResearchMode、mock diagnostics 当目标依据。

**Files:**

- Modify: `apps/web/src/data/types.ts`
- Modify: `apps/web/src/hooks/useStrategies.ts`
- Modify: `apps/web/src/api/strategies.ts`
- Modify: `apps/web/src/api/strategies-config.ts`
- Modify: `apps/web/src/api/preview.ts`
- Modify: `apps/web/src/api/tasks.ts`
- Modify: `apps/web/src/api/diagnostics.ts`
- Modify: `apps/web/src/components/config-panel.tsx`
- Modify: `apps/web/src/components/workspace-page.tsx`
- Modify: `apps/web/src/components/kline-chart.tsx`
- Modify/Create: `apps/web/tests/*.ts`

**Acceptance Criteria:**

- Frontend `StrategySubcategory` 匹配目标 10 值。
- `ResearchModeId` 不用于 Strategy/Workspace 分类。
- `useStrategies` 消费 camelCase API response。
- ConfigPanel 保存 `{ category, subcategory, params, expectedHash }`，保存后持有 `configSnapshot.hash`。
- Workspace mount 时加载 saved/default configSnapshot。
- diagnostics/backtest submission 使用 configSnapshot。
- Workspace 使用真实 diagnostics API data 渲染；mock chart 仅作为空态/显式 demo，不作为完成态。
- KlineChart 消费 target preview shape 或在 API boundary 有 adapter。

**Steps:**

- [ ] 更新 frontend type unions。
- [ ] 更新 strategy API client types。
- [ ] 更新 config API client types。
- [ ] 更新 preview API client types。
- [ ] 更新 task stream result handling。
- [ ] 更新 diagnostics API client。
- [ ] 更新 ConfigPanel save payload。
- [ ] 更新 WorkspacePage config load 和 submit。
- [ ] 更新 diagnostics rendering。
- [ ] 更新 KlineChart preview adapter。
- [ ] Run: `cd apps/web && pnpm test`。
- [ ] Run: `cd apps/web && pnpm build`。
- [ ] Run: `cd apps/web && npm list --depth=0`。
- [ ] Commit: `feat: align frontend consumers with backend strategy contract`。

---

### Phase 9: Residual Cleanup from 06-30 P2/P3

#### Task 9.1: Unify strategy metadata Python channel

**Files:**

- Modify: `packages/strategy-runtime/quantforge_strategy/cli.py`
- Modify: `apps/api/src/services/strategy-sync.ts`
- Modify/Create: `packages/strategy-runtime/tests/test_cli_list_strategies.py`
- Modify/Create: `apps/api/tests/services/strategy-sync.test.ts`

**Acceptance Criteria:**

- CLI 支持 `listStrategies` NDJSON command。
- API strategy catalog 不再使用内联 Python script string。
- API strategy catalog 与 Worker PythonBridge 通道风格一致。

**Steps:**

- [x] 在 CLI 注册 `listStrategies` command。
- [x] 添加 CLI test 覆盖输出 strategy meta list。
- [x] 修改 `strategy-sync.ts` 使用 PythonBridge 调用。
- [x] 删除内联 Python script string。
- [ ] Run: `cd packages/strategy-runtime && pytest tests/test_cli_list_strategies.py -v`。
- [ ] Run: `cd apps/api && pnpm test -- tests/services/strategy-sync.test.ts`。
- [ ] Commit: `refactor: unify strategy metadata bridge`。

#### Task 9.2: Remove dead Worker queue

**Files:**

- Delete: `apps/worker/src/queue.ts`
- Modify: `apps/worker/package.json`
- Modify: root package lock file if dependency changes
- Modify/Create: `apps/worker/tests/*.ts`

**Acceptance Criteria:**

- `apps/worker/src/queue.ts` 删除。
- `better-sqlite3` 只在仍被使用时保留；如果仅 queue 使用，则移除 worker dependency。
- `rg "queue"` 不再出现旧本地队列引用。
- Worker 仍通过 HTTP poll `/api/internal/tasks/pending`。

**Steps:**

- [ ] Run: `rg "queue|better-sqlite3" apps/worker` 确认引用。
- [ ] 删除 `apps/worker/src/queue.ts`。
- [ ] 移除未使用 dependency。
- [ ] Run: `cd apps/worker && pnpm test`。
- [ ] Commit: `chore: remove dead worker queue`。

---

## 5. DB Migration and Cleanup Strategy

1. 迁移前读取 `strategy_configs`、`config_history`、`diagnostic_results`，生成内存 audit list。
2. 安全自动改名：
   - `nonlinear_ml` -> `ml_nonlinear_factor`
   - `high_frequency` -> `hft_microstructure`
3. 非目标旧值不静默合并：
   - `mean_reversion`
   - `tail_risk_hedging`
4. 非目标旧值处理方式：
   - quarantine 到 `data/migration-audits/` 的 JSON audit 文件，或
   - fail startup 并列出 strategy name 和 row id。
5. 旧 config shape `{strategy, params, factorPool, preprocessing}` 归一化成 `ConfigSnapshot.params`。
6. 旧 diagnostics rows 增补：
   - `result_id = id`
   - `result_type = 'diagnostics'`
   - `category/subcategory` 从 configSnapshot 或 strategy registry 推导
   - `engine_version = 'legacy'`
   - `expires_at = created_at + 7 days`
7. `DiagnosticService.purgeExpired(7)` 在 API startup 执行。

---

## 6. Verification Commands

按阶段执行最小验证：

```bash
cd apps/api && pnpm test
cd apps/worker && pnpm test
cd apps/web && pnpm test && pnpm build && npm list --depth=0
cd packages/strategy-runtime && pytest -v
cd packages/strategies && pytest -v
```

全量 smoke：

```bash
pnpm test
pnpm build
```

如存在 `scripts/smoke-test.sh` 且当前 shell 支持：

```bash
bash scripts/smoke-test.sh
```

---

## 7. Execution Notes

- 每个 Phase 可以单独提交；不要把 API 结构整理、taxonomy 迁移、Python diagnostics 算法塞进一个巨型提交。
- 操作任何子项目之前先读对应 `AGENT.md`：
  - `apps/web/AGENT.md`
  - `apps/api/AGENT.md`
  - `apps/worker/AGENT.md`
  - `packages/strategy-runtime/AGENT.md`
  - `packages/strategies/AGENT.md`
- 不建 `contracts/` 中转包；各层 `types.ts` / Python types 镜像并通过测试保证值对齐。
- 不做目录树大搬迁；只做逻辑收拢和局部拆分。
- 前端 mock 数据不再作为完成态依据；真实 API 无数据时展示空态或明确失败。
- 推进顺序上，`apps/api/src/routes/task.ts` 的改动必须按本计划执行：result envelope -> processor registry -> configSnapshot validation -> report/diagnostics persistence。

---

## 8. Self-Review

### 8.1 Spec coverage

| Requirement                     | Covered by                         |
| ------------------------------- | ---------------------------------- |
| 06-29 产品契约迁移              | Phase 2-8                          |
| 06-30 P0 契约止血               | Phase 1                            |
| 06-30 P1 路由和 Processor 整理  | Phase 1.5                          |
| ConfigSnapshot 唯一真相源       | Phase 3, Phase 5, Phase 7, Phase 8 |
| Preview target shape            | Phase 4, Phase 8                   |
| Diagnostics algorithms          | Phase 0, Phase 6                   |
| Worker/Python fail closed       | Phase 5                            |
| Frontend consumer alignment     | Phase 8                            |
| Python channel residual cleanup | Phase 9.1                          |
| Worker dead queue cleanup       | Phase 9.2                          |

### 8.2 Type consistency

- `StrategyCategory` / `StrategySubcategory` 在本计划所有 TS/Python/API/Frontend 章节中使用同一目标值集合。
- Public config request 统一使用 `params`，完整执行态统一使用 `configSnapshot`。
- SSE result envelope 统一使用顶层 `resultId/resultType`。
- Diagnostics persisted response 统一使用 `resultId/resultType/data`，旧 `id/dataJson` 只作为 mapper 兼容输入。
