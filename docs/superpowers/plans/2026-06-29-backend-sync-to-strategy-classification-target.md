# Backend Sync to Strategy Classification Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 API / Worker / Python / DB 契约从当前 2026-06-29 现状迁移到 `docs/superpowers/specs/2026-06-28-strategy-classification-and-config-design.md` 所定义的策略分类、配置、Preview、Task、Diagnostics 目标态。

**Architecture:** 以 06-28 的 `StrategyCategory` / `StrategySubcategory` 为唯一产品分类基准；API 是前端 wire contract 的唯一出口，Worker 只消费 `configSnapshot`，Python CLI 通过 NDJSON 提供真实 backtest/diagnostics 计算。配置和诊断结果采用 Route → Service → Repository → SQLite 分层，`configSnapshot` 是任务执行的唯一配置真相源。

**Tech Stack:** React + TypeScript + Vite；Fastify + TypeScript + Drizzle/sql.js；Node Worker + Python subprocess NDJSON；Python `quantforge_strategy` / `quantforge_strategies` / `quantforge_backtest` / `quantforge_factor`；SQLite.

## Global Constraints

- 目标基准：`docs/superpowers/specs/2026-06-28-strategy-classification-and-config-design.md`。
- 参考但非目标：`docs/superpowers/specs/2026-06-29-strategy-classification-architecture.md` 仅表示当前代码扫描/架构记录。
- 参考但非完整后端设计：`docs/plans/2026-06-29-frontend-workflow-reconciliation.md` 仅表示前端工作流对齐与诊断链路打通草案。
- 当前三层已对齐的 10 个 subcategory 值如果与 06-28 不一致，视为现状差距，不作为目标正确性依据。
- 不把前端 mock 图表当成后端已完成；后端必须返回结构化真实结果或显式失败。
- Task payload 不允许顶层 `params` 与 `configSnapshot` 并存；`configSnapshot` 是唯一真相源。
- Preview 保持 06-28 边界：纯 TypeScript 轻量引擎，不调用 Python；精确绩效以回测/诊断为准。
- Diagnostics 需要先完成更底层算法设计文档，作为 Phase 0 的交付物。
- 用户已拍板采用严格、明确失败、杜绝歧义的生产级策略：旧非目标子分类不静默映射；无保存配置时返回默认 snapshot；canonical request 使用 `params`；public param identity 使用 `name`；Preview 严格输出 06-28 shape；hash 冲突 fail closed；回测报告持久化失败则任务失败；synthetic diagnostics 默认关闭。

---

## 0. 只读扫描结论：现状 vs 06-28 目标差距矩阵

| 维度 | 06-28 目标 | 当前现状 | 差距/风险 | 计划落点 |
|---|---|---|---|---|
| 一级分类 | `factor_based` / `non_factor` / `transitional` | Python 已有三值：`packages/strategy-runtime/quantforge_strategy/types.py:82-86`；API/前端也有三值：`apps/api/src/types.ts:332-333`, `apps/web/src/data/types.ts:120-122` | 一级分类值一致 | Task 1 固化为 canonical contract |
| 子分类：因子型 | `linear_multi_factor`, `index_enhancement`, `ml_nonlinear_factor` | 当前为 `linear_multi_factor`, `nonlinear_ml`：`types.py:91-94`, `apps/api/src/types.ts:336-339` | 缺 `index_enhancement`；`nonlinear_ml` 需更名为 `ml_nonlinear_factor` | Task 1 + Task 8 |
| 子分类：非因子型 | `trend_cta`, `arbitrage`, `hft_microstructure`, `macro_quant`, `event_driven`, `e2e_ai_timeseries` | 当前还有 `mean_reversion`, `high_frequency`, `tail_risk_hedging`：`types.py:95-102` | `high_frequency` 需更名为 `hft_microstructure`；`mean_reversion` / `tail_risk_hedging` 不在 06-28，已拍板 quarantine/fail，不静默合并 | Task 1 + Task 2 |
| 子分类：过渡型 | `event_sentiment_factor` | 当前无 transitional 子分类，`transitional` 前端列表为空：`apps/web/src/components/config-panel.tsx:16-29` | 过渡形态无法精确表达 06-28 的“事件/舆情标准化因子” | Task 1 + Task 6 + Task 8 |
| `StrategyMeta` | `name/category/subcategory/description/params/version`，因子型含 `required_factors/factor_pool` | 当前 `StrategyMeta` 仍要求 `modes`，保留 `kind`，`subcategory` 可空：`meta.py:32-42`；部分策略如 `equal_weight` 未显式分类，会落默认 `NON_FACTOR/None` | 旧 `ResearchMode` 仍在元数据中；分类覆盖不完整 | Task 1 + Task 2 |
| `workflowReady` | 06-28 写明由后端判断“策略已注册 + 有可用标的” | 当前 API 计算为 `subcategory !== null`：`routes/strategy.ts:24-26`；06-29 文档也仅记录这个现状 | 不能用“有子分类”替代产品可工作判断；已拍板使用“注册策略 + canonical 子分类 + 至少一个 active instrument 具备默认 timeframe 的最低 bar 覆盖”作为首版规则 | Task 1 |
| `StrategyKind` | 06-28 兼容性说明保留 | 当前保留：`StrategyKind` 定义在 `types.py:66-72`，API 返回 `kind`：`routes/strategy.ts:21-23` | 容易被误用为分类体系 | Task 1：明确仅为执行/组合语义，不参与导航分类 |
| `StrategyParamDef` identity | 06-28 Python 用 `name`，TS 前端用 `name/type/default/range/options/chartRelevant/uiConstraints` | 当前 Python/API/前端用 `key/label/type/default/min/max/chart_relevant/ui_constraints`：`meta.py:20-29`, `apps/api/src/types.ts:356-367`, `apps/web/src/data/types.ts:185-197` | wire 命名与目标不一致；snake/camel 边界未定义 | Task 1 + Task 13 |
| `chartRelevant/uiConstraints` wire | 前端目标为 camelCase，UIConstraint 支持 `require_when/disable_when/set_default_when/range_when` | 当前 API 输出 snake：`routes/strategy.ts:10-20`，前端手动映射：`useStrategies.ts:7-18`；前端只实现 `disable_when/require_when`：`config-panel.tsx:56-82` | API public contract 未对齐 06-28 TS；前端对约束 DSL 支持不完整 | Task 1 + Task 13；过渡期可同时输出 deprecated snake |
| Config API | GET/PUT `/api/strategies/:name/config`，保存全量拍平配置，hash 乐观锁 | 路由已存在但只保存任意 `config` + `hash`：`routes/config.ts:20-23`；Service 无校验：`services/config-service.ts:12-20` | `ConfigSnapshot` 当前只有 `{strategy, params}` 类型：`apps/api/src/types.ts:369-373`；无法覆盖三类配置 | Task 3 |
| Config DB | `strategy_configs`, `config_history` | 表已存在但列名为 `strategy`，无 category/subcategory/schemaVersion：`schema.ts:43-58`, `connection.ts:124-139` | 无分类索引、无迁移校验、history 不能按目标审计 | Task 4 |
| API/任务存储边界 | 工作流状态要能追踪配置、任务、诊断、回测结果 | 当前 API 自有 sql.js DB 默认 `data/api.db`，data-center/task 主库是 `data/quant.db`；ReportRepository 在 task route 内直接 `new`，未走 service/DI | 已拍板短期保持双库，但必须文档化跨库写入顺序和补偿，不做隐式原子性假设 | Task 4 + Task 6 + Task 12 |
| Preview API | `POST /api/strategies/:name/preview`，`preview_params`，cursor pagination，`fingerprint`, `engine_version` | 路由和 TS PreviewService 已存在：`routes/preview.ts:17-53`, `services/preview-service.ts:40-136`；`:name` 当前未使用：`routes/preview.ts:18` | 当前不校验 strategy/config/category；pagination 缺 `total_count`；overlay/signal shape 与 06-28/前端互相不一致 | Task 5 + Task 13 |
| Task payload | `configSnapshot` 唯一真相源，无顶层 `params` | Backtest handler 仍接受 `payload.params` fallback：`apps/worker/src/handlers/backtest-handler.ts:17-18,45`；API 保存报告仍按顶层 payload 字段理解：`routes/task.ts:149-168`；Workspace 提交 diagnostics 空 params：`workspace-page.tsx:326-334` | params 漂移风险；诊断/回测/报告记录可能不一致 | Task 6 + Task 7 + Task 12 + Task 13 |
| SSE result | result 事件含 `resultId/resultType` | API complete 对 diagnostics 把 resultId/resultType 塞入 `data`，但 SSE 顶层事件没有 resultId：`routes/task.ts:118-143` | 页面恢复依赖解析 data 内字段；backtest 无 resultId/resultType | Task 6 + Task 12 |
| Diagnostics API | `GET /api/diagnostics/:resultId` 和 `GET /api/diagnostics?strategy=...` | 路由已存在：`routes/diagnostics.ts:10-25`；返回 current `DiagnosticResult` | response shape 是 `id/dataJson`，无 category/subcategory/resultType/expiresAt；列表只能按 strategy 查 | Task 6 |
| Worker task surface | Worker 应明确支持或拒绝每个 API task type | Worker enum 有 `factor_compute/factor_eval/ai_train`，但 `main.ts` 只接 `backtest/collect/diagnostics`：`main.ts:18-33` | 类型声明与实际处理能力不一致，未来任务会进入 unsupported 失败 | Task 7；如非本轮范围需显式标为 out-of-scope |
| Worker diagnostics | Worker 传 category/configSnapshot 给 Python diagnostics；无 echo fallback | 当前 `DiagnosticsHandler` 对 UNKNOWN/失败回显成功：`handlers/diagnostics-handler.ts:44-52`；请求只传 `{config:{strategyParams}}`：`handlers/diagnostics-handler.ts:29-35` | 假阳性，前端以为诊断完成 | Task 7 |
| Python CLI | 支持 `backtest` / `diagnostics` NDJSON | CLI `_COMMANDS` 无 diagnostics：`cli.py:69-75` | diagnostics task 必然 UNKNOWN_COMMAND，Worker 又 echo | Task 8 |
| Python backtest input | 从 `configSnapshot` 读取配置 | 当前 `commands/backtest.py` 读 `params.config.strategyParams`：`backtest.py:25-27,67`；runner/backtest config 只保留 `strategyKind`，未带 category/subcategory | Worker 必须转换，CLI 必须升级；报告/Obsidian 如需分类也要补 | Task 7 + Task 8 + Task 12 |
| Python diagnostics algorithms | 因子型 IC/分层/相关性；非因子参数敏感/信号/滑点；过渡型事件/舆情→标准化因子映射 | 无 `commands/diagnostics.py` 文件 | 最大缺口，需要算法设计先行；06-28 没锁死每个 subtype JSON 细节，Phase 0 必须补 | Phase 0 + Task 9-11 |
| Frontend consumption | 06-28 StrategyRow + ConfigSnapshot + Preview + Diagnostics | 当前仍有 `ResearchModeId` 和旧子分类：`apps/web/src/data/types.ts:115,123-134`；ConfigPanel 有前端本地配置但保存 shape 不等于目标：`config-panel.tsx:246-272`；Workspace 图表大量 mock：`workspace-page.tsx:29-81,245-294`；`strategy.name`/`strategy.id` 混用 | 后端完成后前端需二次接线；不能把现状前端当完成 | Task 13 |

---

## 1. 推荐后端目标架构

### 1.1 分类与命名边界

**Canonical enum 只取 06-28：**

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

**旧值迁移策略：**

| 当前值 | 目标动作 | 输出到前端/API | DB 迁移建议 |
|---|---|---|---|
| `nonlinear_ml` | 更名为 `ml_nonlinear_factor` | 不再输出旧值 | 安全自动改名 |
| `high_frequency` | 更名为 `hft_microstructure` | 不再输出旧值 | 安全自动改名 |
| `mean_reversion` | 非 06-28 目标值 | 不输出；迁移脚本标记 incompatible | 已拍板：不静默合并；迁移 quarantine/fail 并输出审计清单 |
| `tail_risk_hedging` | 非 06-28 目标值 | 不输出；迁移脚本标记 incompatible | 已拍板：不静默合并；迁移 quarantine/fail 并输出审计清单 |
| 缺失 `index_enhancement` | 新增 | 输出 | 需要策略元数据补齐 |
| 缺失 `event_sentiment_factor` | 新增 | 输出 | transitional 默认子分类 |

### 1.2 `StrategyMeta` / `StrategyParamDef` contract

**Python internal（snake_case）：**

```python
@dataclass(frozen=True)
class StrategyParamDef:
    name: str
    label: str | None
    type: Literal['int', 'float', 'select', 'bool', 'slider']
    default: Any
    range: tuple[float, float] | None = None
    options: list[str] | None = None
    chart_relevant: bool = False
    ui_constraints: list[UIConstraint] | None = None

@dataclass(frozen=True)
class StrategyMeta:
    name: str
    category: StrategyCategory
    subcategory: StrategySubcategory
    description: str
    params: list[StrategyParamDef]
    version: str
    kind: StrategyKind = StrategyKind.Combined
    required_factors: list[str] | None = None
    factor_pool: str | None = None
```

**API public wire（camelCase，对齐前端）：**

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

**边界规则：**

- Python dataclass 和 DB JSON 内部可以保留 snake_case。
- API response 对前端统一 camelCase：`chartRelevant/uiConstraints/targetField/targetValue/actionValue`。
- `configSnapshot.params` 内部的策略参数名使用量化领域 snake_case（如 `lookback_window`），因为这是配置 key，不是 JSON wrapper 命名。
- 过渡期 API 可接受旧 snake input，但 output 只保证 camelCase；旧字段输出若保留，只能标记 deprecated，并在前端切换完成后删除。
- `StrategyKind` 保留为执行语义：select/timing/position/composite/combined 只说明策略在回测引擎中的角色，不参与 Strategy 页面分组，也不替代 category/subcategory。

### 1.3 `ConfigSnapshot`：全量拍平，唯一真相源

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

type ConfigSnapshot = ConfigSnapshotBase & (
  | { category: 'factor_based'; params: FactorBasedConfigParams & Record<string, unknown> }
  | { category: 'non_factor'; params: NonFactorConfigParams & Record<string, unknown> }
  | { category: 'transitional'; subcategory: 'event_sentiment_factor'; params: TransitionalConfigParams & Record<string, unknown> }
);
```

**Config API target：**

```typescript
// GET /api/strategies/:name/config
// Response 200
{
  persisted: boolean,
  configSnapshot: ConfigSnapshot
}

// PUT /api/strategies/:name/config
// Request
{
  category: StrategyCategory,
  subcategory: StrategySubcategory,
  params: Record<string, unknown>,
  expectedHash?: string
}

// Response 201/200
{
  saved: true,
  configSnapshot: ConfigSnapshot
}

// Conflict 409
{
  error: 'CONFIG_HASH_CONFLICT',
  current: ConfigSnapshot
}
```

**规则：**

- `params` 是拍平后的完整配置对象；不再同时保存 `params`、`factorPool`、`preprocessing` 等多个 truth source。
- `PUT` 时服务端从 strategy registry 拉取 meta，校验 category/subcategory 与策略注册值一致。
- `hash` 由服务端对 canonical JSON 计算，客户端只传 `expectedHash` 做乐观锁。
- `config_history` 每次成功保存透明追加；Service 不直接操作 history repo。
- `GET` 没有保存配置时，已拍板返回 `200 { persisted:false, configSnapshot: defaults }`，让 Workspace 不需要先处理 404 才能提交诊断。

### 1.4 Preview API

```typescript
// POST /api/strategies/:name/preview
// Request
{
  symbol: string;
  timeframe: string;
  cursor: number | null;
  limit?: number;
  preview_params: Record<string, unknown>;
}

// Response
{
  symbol: string;
  bars: Array<{ ts: number; o: number; h: number; l: number; c: number; v: number }>;
  overlays: Array<
    | { type: 'line'; label: string; data: Array<{ ts: number; value: number }>; style?: { color?: string; width?: number } }
    | { type: 'marker'; label: string; data: Array<{ ts: number; kind: string; value?: number }> }
    | { type: 'histogram'; label: string; data: Array<{ ts: number; value: number }> }
  >;
  signals: Array<{ ts: number; side: 'buy' | 'sell'; price: number; reason: string; factor_snapshot: Record<string, number> | null }>;
  pagination: { has_more: boolean; next_cursor: number | null; total_count: number | null };
  fingerprint: string;
  engine_version: string;
}
```

**PreviewService 消费规则：**

- Route 根据 `:name` 查 strategy meta，得到 canonical `category/subcategory`。
- `preview_params` 只接受 `chartRelevant=true` 的参数；非 chart-relevant 字段已拍板返回 422，禁止静默忽略。
- 如果存在保存配置，PreviewService 合并 `savedSnapshot.params` + `preview_params`；`preview_params` 只覆盖 chart-relevant 子集。
- 因子型 preview 只显示轻量因子 score/因子快照/均线，不代替 IC/分层诊断。
- 非因子型 preview 显示 MA/MACD/RSI/价差等轻量 overlay 和虚拟信号。
- 过渡型 `event_sentiment_factor` preview 显示情感衰减 score、映射目标因子标签和轻量事件 marker；不声称已完成因子挂载验证。
- Preview 不调用 Python；回测和诊断结果是精确链路。

### 1.5 Task / SSE / Diagnostics API

**Diagnostics task payload：**

```typescript
{
  type: 'diagnostics',
  payload: {
    strategy: string,
    symbol: string,
    timeframe: string,
    startTs?: number,
    endTs?: number,
    configSnapshot: ConfigSnapshot
  }
}
```

**Backtest task payload：**

```typescript
{
  type: 'backtest',
  payload: {
    strategy: string,
    symbol: string,
    timeframe: string,
    initialCash: number,
    slippage: number,
    startTs?: number,
    endTs?: number,
    configSnapshot: ConfigSnapshot
  }
}
```

**SSE result event：**

```text
event: result
data: {"type":"result","taskId":"task-1","resultId":"diag_...","resultType":"diagnostics","data":{...}}
```

```text
event: result
data: {"type":"result","taskId":"task-2","resultId":"report_...","resultType":"backtest","data":{...}}
```

**Diagnostics result response：**

```typescript
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

// GET /api/diagnostics/:resultId -> DiagnosticResultWire
// GET /api/diagnostics?strategy=xxx&limit=20 -> { items: DiagnosticResultSummary[], nextCursor: number | null }
```

### 1.6 Worker Bridge / Python CLI target

**Worker → Python diagnostics request：**

```json
{
  "command": "diagnostics",
  "strategy": "dual_ma",
  "configSnapshot": { "schemaVersion": 1, "strategy": "dual_ma", "category": "non_factor", "subcategory": "trend_cta", "params": {}, "hash": "sha256:...", "strategyVersion": "0.1.0", "updatedAt": 1717200000000 },
  "dataRange": { "dbPath": "data/quant.db", "symbol": "600519", "timeframe": "1d", "startTs": 1672531200, "endTs": 1717200000 }
}
```

**Worker → Python backtest request：**

```json
{
  "command": "backtest",
  "strategy": "dual_ma",
  "configSnapshot": { "schemaVersion": 1, "strategy": "dual_ma", "category": "non_factor", "subcategory": "trend_cta", "params": {}, "hash": "sha256:...", "strategyVersion": "0.1.0", "updatedAt": 1717200000000 },
  "execution": { "initialCash": 1000000, "slippage": 0.0001 },
  "dataRange": { "dbPath": "data/quant.db", "symbol": "600519", "timeframe": "1d", "startTs": 1672531200, "endTs": 1717200000 }
}
```

**Python stdout NDJSON：**

```json
{"event":"progress","stage":"load_data","percent":10,"message":"Loading bars"}
{"event":"log","level":"info","message":"Loaded 1250 bars"}
{"event":"result","result_type":"diagnostics","data":{"type":"non_factor","subcategory":"trend_cta"}}
{"event":"error","error":{"code":"NO_DATA","message":"No bars for symbol"}}
```

**Echo fallback policy：**

- 删除 Worker diagnostics echo fallback；Python `UNKNOWN_COMMAND`、空 result、parse failure 均使 task failed。
- 如需本地演示，使用显式环境变量 `ALLOW_SYNTHETIC_DIAGNOSTICS=1`，默认关闭，且 SSE/result 必须带 `synthetic:true`。生产计划不依赖该分支。

### 1.7 Python diagnostics result shapes

> 说明：06-28 锁定的是 diagnostics 的分类目标与图表/研究内容方向；每个 subtype 的 JSON 字段级 schema 没有完全锁死。以下 shape 是本后端计划建议冻结的目标 contract，必须在 Phase 0 算法契约文档中复核并经用户确认后再实现。

```typescript
interface FactorDiagnosticsResult {
  type: 'factor_based';
  subcategory: 'linear_multi_factor' | 'index_enhancement' | 'ml_nonlinear_factor';
  ic_series: Array<{ ts: number; factor: string; ic: number; rank_ic: number }>;
  layered_returns: Array<{ factor: string; group: string; return: number; benchmark_return?: number }>;
  correlation_matrix: { labels: string[]; values: number[][]; method: 'pearson' | 'spearman' };
  summary: { mean_ic: number; ic_std: number; ic_ir: number; mean_rank_ic: number; coverage: number };
}

interface NonFactorDiagnosticsResult {
  type: 'non_factor';
  subcategory: 'trend_cta' | 'arbitrage' | 'hft_microstructure' | 'macro_quant' | 'event_driven' | 'e2e_ai_timeseries';
  param_sensitivity: Array<{ param: string; values: number[]; returns: number[]; sharpe: number[]; max_drawdown?: number[] }>;
  signal_quality: { total_signals: number; win_rate: number; avg_holding_bars: number; profit_factor: number; max_consecutive_losses: number };
  slippage_stress: Array<{ bps: number; return: number; sharpe: number; trade_count: number }>;
}

interface TransitionalDiagnosticsResult {
  type: 'transitional';
  subcategory: 'event_sentiment_factor';
  sentiment_decay: Array<{ half_life: number; ic: number; signal_count: number; effective_window: number }>;
  mapping_targets: Array<{ target_factor: string; coverage: number; correlation: number; stability: number }>;
  standardized_factor_quality: { missing_ratio: number; outlier_ratio: number; mean: number; std: number; rank_ic: number; monotonicity: number };
  mapping_validation: Array<{ check: 'lead_lag' | 'cross_sectional_coverage' | 'factor_library_attach' | 'decay_robustness'; passed: boolean; value: number | string; threshold: number | string }>;
}
```

---

## 2. File Structure / Responsibility Map

### Python runtime and strategies

- Modify: `packages/strategy-runtime/quantforge_strategy/types.py` — canonical category/subcategory/param/task enum values.
- Modify: `packages/strategy-runtime/quantforge_strategy/meta.py` — `StrategyMeta`, `StrategyParamDef`, `UIConstraint` target fields and compatibility properties.
- Modify: `packages/strategy-runtime/quantforge_strategy/cli.py` — register `diagnostics`; route `backtest` requests using `configSnapshot`.
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/backtest.py` — accept target `configSnapshot` request while retaining current internal runner translation.
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py` — diagnostics command dispatcher.
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/factor.py` — factor diagnostics algorithms.
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/non_factor.py` — non-factor diagnostics algorithms.
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/transitional.py` — event/sentiment→standardized factor diagnostics algorithms.
- Modify: `packages/strategies/quantforge_strategies/**/*.py` — strategy meta category/subcategory values and param definitions.
- Modify/Create tests under `packages/strategy-runtime/tests/` and `packages/strategies/tests/` — contract and command tests.

### API

- Modify: `apps/api/src/types.ts` — canonical enum, `ConfigSnapshot`, strategy param wire types, task payloads, diagnostics result types.
- Modify: `apps/api/src/services/strategy-sync.ts` — Python registry sync normalization from Python snake_case to API internal model.
- Modify: `apps/api/src/routes/strategy.ts` — output target `StrategyRowWire`.
- Modify: `apps/api/src/routes/config.ts` — GET/PUT final contract with validation and optimistic lock.
- Modify: `apps/api/src/services/config-service.ts` — defaults, validation, canonical hash.
- Modify: `apps/api/src/repositories/interfaces.ts` — target config/history/diagnostic repo interfaces.
- Modify: `apps/api/src/repositories/sqlite-config-repo.ts` — target persistence and history append.
- Modify: `apps/api/src/storage/schema.ts` — target table columns/indexes.
- Modify: `apps/api/src/storage/connection.ts` — create/migrate target tables.
- Modify: `apps/api/src/services/preview-service.ts` — category-aware preview response builder.
- Modify: `apps/api/src/routes/preview.ts` — final preview request/response validation.
- Modify: `apps/api/src/routes/task.ts` — task validation, SSE result shape, diagnostics/backtest result persistence order.
- Modify: `apps/api/src/services/diagnostic-service.ts` — result shape/list/purge semantics.
- Modify: `apps/api/src/repositories/sqlite-diag-repo.ts` — target `diagnostic_results` schema.
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts` — composition root wiring if service constructor dependencies change.
- Modify/Create tests under `apps/api/tests/` — routes/services/storage contract tests.

### Worker

- Modify: `apps/worker/src/types.ts` — canonical task payload/result/NDJSON types.
- Modify: `apps/worker/src/handlers/diagnostics-handler.ts` — no echo fallback; pass `configSnapshot` and dataRange.
- Modify: `apps/worker/src/handlers/backtest-handler.ts` — remove `params` fallback; pass `configSnapshot` and execution.
- Modify: `apps/worker/src/python-bridge.ts` — stronger final-event parsing and error propagation if needed.
- Modify: `apps/worker/src/main.ts` — forward result/error/progress consistently.
- Modify/Create tests under `apps/worker/tests/` — handler and bridge tests.

### Frontend consumer follow-up only

- Modify later: `apps/web/src/data/types.ts` — target enum and response types.
- Modify later: `apps/web/src/hooks/useStrategies.ts` — remove snake mapping once API wire is camelCase.
- Modify later: `apps/web/src/components/config-panel.tsx` — save target flattened `ConfigSnapshot.params` shape.
- Modify later: `apps/web/src/components/workspace-page.tsx` — fetch saved/default config, submit diagnostics/backtest with configSnapshot, render real diagnostics.
- Modify later: `apps/web/src/api/*` — target endpoint types and 404/default handling.

---

## 3. Phased Implementation Plan

### Phase 0: Diagnostics Algorithm Contract Document

**Why Phase 0:** 06-28 对 diagnostics 的 UI/产品目标明确，但底层算法仍未定义到可实现粒度，尤其 `transitional/event_sentiment_factor` 不能只做数据源完整性，必须定义“事件/舆情 → 标准化因子映射 → 挂载到因子库”的算法和验收指标。

#### Task 0: Write diagnostics algorithm design document

**Goal:** 在写 Python diagnostics 代码前，冻结因子型、非因子型、过渡型诊断算法、输入数据要求、输出字段和错误策略。

**Files:**
- Create: `docs/superpowers/specs/2026-06-29-diagnostics-algorithm-contract.md`
- Read for context: `docs/superpowers/specs/2026-06-28-strategy-classification-and-config-design.md`
- Read for context: `packages/strategy-runtime/quantforge_strategy/commands/factor_eval.py`
- Read for context: `packages/strategy-runtime/quantforge_strategy/commands/backtest.py`

**Input/Output Interfaces:**
- Consumes: `ConfigSnapshot`, `dataRange`, strategy registry meta.
- Produces: `FactorDiagnosticsResult`, `NonFactorDiagnosticsResult`, `TransitionalDiagnosticsResult` schemas exactly matching section 1.7.

**Test Method:**
- Documentation review checklist in the new spec:
  - Each result field has a formula or derivation rule.
  - Each category has at least one no-data error code and one partial-data degradation rule.
  - Transitional diagnostics includes sentiment decay, mapping target factors, standardized factor quality, and mapping validation.

**Acceptance Criteria:**
- The document explicitly defines IC windowing, forward return horizon, layer count, correlation method, parameter scan grid, slippage bps grid, event sentiment decay formula, and factor-library attach validation.
- The document states which data source each calculation reads and how missing data is reported.
- User reviews and approves the design before Task 6 begins.

**Dependencies:** None.

**Steps:**
- [ ] Read 06-28 target diagnostics sections and current factor/backtest command code.
- [ ] Create the algorithm contract document with sections: inputs, outputs, factor_based, non_factor, transitional, error codes, performance limits.
- [ ] Include a concrete JSON example for each diagnostics result type.
- [ ] Add a review checklist at the bottom of the document.
- [ ] Commit: `docs: add diagnostics algorithm contract`.

---

### Phase 1: Canonical Strategy Types and Registry Output

#### Task 1: Align Python/API strategy enums and metadata contract to 06-28

**Goal:** 让 Python registry 和 API `/api/strategies` 只输出 06-28 canonical category/subcategory 和 target parameter wire shape。

**Files:**
- Modify: `packages/strategy-runtime/quantforge_strategy/types.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/meta.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/__init__.py`
- Modify: `packages/strategy-runtime/tests/test_strategy_categories.py`
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/services/strategy-sync.ts`
- Modify: `apps/api/src/routes/strategy.ts`
- Modify/Create: `apps/api/tests/routes/strategy.test.ts`

**Input/Output Interfaces:**
- Consumes: Python strategy classes exposing `.meta`.
- Produces: `GET /api/strategies` and `GET /api/strategies/:name` response using `StrategyRowWire` from section 1.2.

**Test Method:**
- `cd packages/strategy-runtime && pytest tests/test_strategy_categories.py -v`
- `cd apps/api && pnpm test -- tests/routes/strategy.test.ts`
- Add API test assertion that no response contains `nonlinear_ml`, `high_frequency`, `mean_reversion`, or `tail_risk_hedging`.

**Acceptance Criteria:**
- Python enum includes exactly 10 target subcategory values from 06-28.
- API `StrategySubcategory` type includes exactly the same 10 target values.
- Strategy route maps `chart_relevant/ui_constraints/target_field` to `chartRelevant/uiConstraints/targetField` on public wire.
- `workflowReady` is computed from target product semantics: strategy is registered, canonical `category/subcategory` is present, and at least one supported instrument/data range is available; it is not merely `subcategory !== null`.
- The availability rule is implemented behind a focused helper and covered by tests for registered-with-data, registered-without-data, and unregistered strategy cases.
- `StrategyKind` remains optional output, documented in code comments as execution semantics only.

**Dependencies:** None.

**Steps:**
- [ ] Update Python enum values to 06-28 target, keeping no canonical members for old subcategories.
- [ ] Update `StrategyParamDef` to expose canonical `name/range` while providing compatibility properties for existing strategy code that still uses `key/min/max` during migration.
- [ ] Update `StrategyMeta` so `category` and `subcategory` are required for new strategies; keep `kind` as execution-only field.
- [ ] Update strategy sync script to emit target wire fields and normalize Python internal snake_case to API camelCase.
- [ ] Implement and test `workflowReady` using registered strategy + canonical category/subcategory + available instrument/data coverage, not the current `subcategory !== null` shortcut.
- [ ] Update strategy route tests to assert canonical enum list, wire naming, and workflowReady semantics.
- [ ] Run Python and API tests listed above.
- [ ] Commit: `feat: align strategy metadata contract to target taxonomy`.

#### Task 2: Migrate registered strategy metadata to canonical subcategories

**Goal:** 所有实际注册策略输出 canonical 06-28 子分类；旧子分类只作为迁移输入，不作为 registry/API 输出。

**Files:**
- Modify: `packages/strategies/quantforge_strategies/combined/*.py`
- Modify: `packages/strategies/quantforge_strategies/selectors/*.py`
- Modify: `packages/strategies/quantforge_strategies/timers/*.py`
- Modify: `packages/strategies/quantforge_strategies/sizers/*.py`
- Create/Modify: `packages/strategies/tests/test_strategy_meta_contract.py`

**Input/Output Interfaces:**
- Consumes: `StrategyCategory`, `StrategySubcategory`, `StrategyMeta`.
- Produces: `quantforge_strategies.list_all()` entries whose meta subcategory is in the 06-28 set.

**Test Method:**
- `cd packages/strategies && pytest tests/test_strategy_meta_contract.py -v`
- `cd apps/api && pnpm test -- tests/routes/strategy.test.ts`

**Acceptance Criteria:**
- `momentum_selector` remains `factor_based/linear_multi_factor` unless explicitly redesigned.
- `ai_predictor` remains `non_factor/e2e_ai_timeseries`.
- `dual_ma`, `rsi`, `bollinger_band`, `macd`, `kdj`, `ma_crossover` remain `non_factor/trend_cta`.
- No actual registered strategy emits unsupported old values.
- If no current strategy maps to `index_enhancement`, `ml_nonlinear_factor`, `hft_microstructure`, or `event_sentiment_factor`, registry tests still allow the enum but do not fabricate strategy entries.

**Dependencies:** Task 1.

**Steps:**
- [ ] Update imports and enum references in strategy files.
- [ ] Replace any `NONLINEAR_ML` references with `ML_NONLINEAR_FACTOR`.
- [ ] Replace any `HIGH_FREQUENCY` references with `HFT_MICROSTRUCTURE`.
- [ ] Add registry contract test that iterates `list_all()` and validates `meta.category/subcategory` against canonical mapping.
- [ ] Run Python registry and API strategy tests.
- [ ] Commit: `feat: migrate registered strategies to target subcategories`.

---

### Phase 2: ConfigSnapshot, Config API, DB, and Repositories

#### Task 3: Implement full ConfigSnapshot contract and validation service

**Goal:** `GET/PUT /api/strategies/:name/config` 返回/保存完整 `ConfigSnapshot`，覆盖 FactorBasedConfig、NonFactorConfig、TransitionalConfig，并通过 hash 乐观锁防止覆盖漂移。

**Files:**
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/services/config-service.ts`
- Modify: `apps/api/src/routes/config.ts`
- Modify: `apps/api/src/repositories/interfaces.ts`
- Modify/Create: `apps/api/tests/routes/config.test.ts`
- Modify/Create: `apps/api/tests/services/config-service.test.ts`

**Input/Output Interfaces:**
- Consumes PUT request:
  ```json
  {"category":"non_factor","subcategory":"trend_cta","params":{"lookback_window":20,"hold_period":5,"indicators":["macd"],"indicator_params":{"macd_fast":12},"dynamic_params":{}},"expectedHash":"sha256:old"}
  ```
- Produces GET/PUT response:
  ```json
  {"persisted":true,"configSnapshot":{"schemaVersion":1,"strategy":"dual_ma","strategyVersion":"0.1.0","category":"non_factor","subcategory":"trend_cta","params":{},"hash":"sha256:new","updatedAt":1717200000000}}
  ```

**Test Method:**
- `cd apps/api && pnpm test -- tests/services/config-service.test.ts tests/routes/config.test.ts`
- Test 409 conflict by saving once, then PUT with stale `expectedHash`.
- Test default snapshot behavior for no saved config according to user-approved policy.

**Acceptance Criteria:**
- `ConfigSnapshot` contains `schemaVersion`, `strategy`, `strategyVersion`, `category`, `subcategory`, `params`, `hash`, `updatedAt`.
- PUT rejects category/subcategory mismatch with strategy registry.
- PUT rejects missing required fields for each category:
  - factor_based: `factor_pool`, `winsorize`, `neutralization`, `standardization`.
  - non_factor: `lookback_window`, `hold_period`, `indicators`, `indicator_params`, `dynamic_params`.
  - transitional/event_sentiment_factor: `data_source`, `sentiment_decay_half_life`, `target_factor_pool`.
- Hash is server-computed from canonical JSON; client cannot choose arbitrary saved hash.
- Existing `{ config, hash }` input is accepted only as compatibility alias if explicitly added in tests.

**Dependencies:** Task 1.

**Steps:**
- [ ] Define `ConfigSnapshot` and category-specific config param types in API `types.ts`.
- [ ] Implement canonical JSON stringify and `sha256:` hash helper in `config-service.ts` or a focused utility file.
- [ ] Implement category-specific validation functions.
- [ ] Update config route GET/PUT response shapes.
- [ ] Add route tests for factor_based, non_factor, transitional saves.
- [ ] Add route tests for hash conflict and category mismatch.
- [ ] Run API config tests.
- [ ] Commit: `feat: add config snapshot contract and validation`.

#### Task 4: Upgrade config and diagnostics DB schema/repositories

**Goal:** SQLite schema and repositories preserve target config/diagnostic metadata, enable history audit, strategy listing, result recovery, and purge.

**Files:**
- Modify: `apps/api/src/storage/schema.ts`
- Modify: `apps/api/src/storage/connection.ts`
- Modify: `apps/api/src/repositories/sqlite-config-repo.ts`
- Modify: `apps/api/src/repositories/sqlite-diag-repo.ts`
- Modify: `apps/api/src/repositories/interfaces.ts`
- Modify/Create: `apps/api/tests/storage/config-repo.test.ts`
- Modify/Create: `apps/api/tests/storage/diagnostic-repo.test.ts`

**Input/Output Interfaces:**
- `IConfigRepo.get(strategyName): Promise<ConfigSnapshot | null>`
- `IConfigRepo.save(snapshot, expectedHash?): Promise<ConfigSnapshot>`
- `IConfigHistoryRepo.list(strategyName, limit, offset)` returns history entries with category/subcategory/hash/createdAt.
- `IDiagnosticRepo.save(result: DiagnosticResultWire): Promise<void>`
- `IDiagnosticRepo.listByStrategy(strategyName, limit, cursor)` returns summaries plus cursor.

**Final Tables:**

```sql
CREATE TABLE strategy_configs (
  strategy_name TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  strategy_version TEXT NOT NULL,
  config_json TEXT NOT NULL,
  hash TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_strategy_configs_category ON strategy_configs(category, subcategory);
```

```sql
CREATE TABLE config_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  strategy_version TEXT NOT NULL,
  config_json TEXT NOT NULL,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_config_history_strategy_created ON config_history(strategy_name, created_at DESC);
```

```sql
CREATE TABLE diagnostic_results (
  result_id TEXT PRIMARY KEY,
  result_type TEXT NOT NULL,
  task_id TEXT NOT NULL,
  strategy_name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT NOT NULL,
  config_snapshot TEXT NOT NULL,
  data_json TEXT NOT NULL,
  engine_version TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_diag_strategy_created ON diagnostic_results(strategy_name, created_at DESC);
CREATE INDEX idx_diag_task ON diagnostic_results(task_id);
CREATE INDEX idx_diag_type_created ON diagnostic_results(result_type, created_at DESC);
CREATE INDEX idx_diag_expires ON diagnostic_results(expires_at);
```

**Test Method:**
- `cd apps/api && pnpm test -- tests/storage/config-repo.test.ts tests/storage/diagnostic-repo.test.ts`
- Migration probe: start with old tables from current `connection.ts`, insert representative rows, initialize DB, verify rows are migrated or rejected with an audit error.

**Acceptance Criteria:**
- DB has category/subcategory indexes for config and diagnostics.
- Diagnostics table has `result_type` and `task_id` as first-class fields.
- The plan for API `data/api.db` vs data-center `data/quant.db` is explicit: either keep dual DB with documented cross-write ordering and compensation, or consolidate target workflow tables into one DB. No implicit cross-DB transaction assumptions.
- Report persistence is moved behind injected repository/service boundaries or explicitly documented as legacy until Task 12; routes do not instantiate new repositories ad hoc in new code.
- `purgeOlderThan(7)` deletes expired rows and returns affected count where driver supports it.
- Existing rows with `nonlinear_ml` and `high_frequency` are migrated to new names.
- Existing rows with `mean_reversion` or `tail_risk_hedging` are not silently remapped; migration records a clear incompatible value error or quarantines them per user decision.

**Dependencies:** Task 3.

**Steps:**
- [ ] Update Drizzle schema definitions.
- [ ] Decide and document the API DB vs data-center DB ownership boundary for strategy_configs/config_history/diagnostic_results/backtest_reports/tasks.
- [ ] Update SQL table creation and idempotent migration path in `connection.ts`.
- [ ] Update config repositories to read/write target columns and append history after successful save.
- [ ] Update diagnostic repository to read/write `DiagnosticResultWire` shape.
- [ ] Add repository tests for save/get/history/list/purge.
- [ ] Add migration tests for old safe-renamed subcategory values.
- [ ] Run API storage tests.
- [ ] Commit: `feat: upgrade config and diagnostic persistence schema`.

---

### Phase 3: Preview API Target Contract

#### Task 5: Make PreviewService strategy-aware and target-shaped

**Goal:** `POST /api/strategies/:name/preview` 对齐 06-28 response shape，并按 category/subcategory/config 选择轻量 preview 逻辑。

**Files:**
- Modify: `apps/api/src/services/preview-service.ts`
- Modify: `apps/api/src/routes/preview.ts`
- Modify: `apps/api/src/types.ts`
- Modify/Create: `apps/api/tests/routes/preview.test.ts`
- Modify/Create: `apps/api/tests/services/preview-service.test.ts`

**Input/Output Interfaces:**
- Consumes: strategy name, saved/default `ConfigSnapshot`, `preview_params`, bars from data-center.
- Produces: target preview response in section 1.4 with `total_count` and `engine_version`.

**Test Method:**
- `cd apps/api && pnpm test -- tests/services/preview-service.test.ts tests/routes/preview.test.ts`
- Tests for first page `cursor:null`, older page cursor, stable fingerprint, changed params changing fingerprint.
- Tests for factor_based/non_factor/transitional branch labels.

**Acceptance Criteria:**
- Route 404s unknown strategy.
- Route validates `symbol` and `timeframe`.
- Route rejects non-chart-relevant `preview_params` with an explicit 422 error; no silent ignore or best-effort mutation.
- Response contains `pagination.total_count` when known; `null` is allowed only when repository cannot count without full scan.
- `fingerprint` is `sha256:` prefixed and changes when chart-relevant params or last 10 closes change.
- PreviewService does not import or invoke Python.

**Dependencies:** Task 1, Task 3.

**Steps:**
- [ ] Define preview wire types in API `types.ts`.
- [ ] Update route to load strategy meta and optional saved/default config snapshot.
- [ ] Normalize bar shape to `{ts,o,h,l,c,v}`.
- [ ] Normalize overlay/signal shape to 06-28 target.
- [ ] Add category/subcategory branch tests.
- [ ] Add fingerprint and pagination tests.
- [ ] Run preview tests.
- [ ] Commit: `feat: align preview api with strategy classification target`.

---

### Phase 4: Task, SSE, Diagnostics API, and Result Persistence

#### Task 6: Validate task payloads and emit recovery-ready SSE results

**Goal:** API task submission enforces `configSnapshot` as唯一真相源，并让 diagnostics/backtest result SSE 都包含恢复所需 `resultId/resultType`。

**Files:**
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/routes/task.ts`
- Modify: `apps/api/src/plugins/task-service.ts`
- Modify: `apps/api/src/plugins/sqlite-task-service.ts`
- Modify: `apps/api/src/services/diagnostic-service.ts`
- Modify: `apps/api/src/routes/diagnostics.ts`
- Modify/Create: `apps/api/tests/routes/task.test.ts`
- Modify/Create: `apps/api/tests/routes/diagnostics.test.ts`

**Input/Output Interfaces:**
- Consumes: target diagnostics/backtest task payloads from section 1.5.
- Produces: SSE `result` event with top-level `resultId` and `resultType`.
- Produces: diagnostics API response shape from section 1.5.

**Test Method:**
- `cd apps/api && pnpm test -- tests/routes/task.test.ts tests/routes/diagnostics.test.ts`
- SSE test using `app.inject` or task service subscription to assert event payload.
- Complete-route test for diagnostics stores diagnostic result before emitting final event.
- Complete-route test for backtest saves report before emitting result event and uses report id as `resultId`.

**Acceptance Criteria:**
- `POST /api/tasks` rejects payloads containing top-level `params`.
- `payload.strategy` must equal `payload.configSnapshot.strategy`.
- `payload.configSnapshot.category/subcategory` must be canonical.
- Diagnostics complete persists result and SSE emits `{resultId,resultType:'diagnostics'}`.
- Backtest complete persists report first and SSE emits `{resultId: report.id,resultType:'backtest'}`.
- `GET /api/diagnostics/:resultId` returns `resultId/resultType/taskId/strategy/category/subcategory/configSnapshot/data/createdAt/expiresAt/engineVersion`.
- `GET /api/diagnostics?strategy=...` returns `{items,nextCursor}` summaries and supports `limit`.

**Dependencies:** Task 3, Task 4.

**Steps:**
- [ ] Add task payload validation helpers.
- [ ] Update `POST /api/tasks` to validate diagnostics/backtest payloads.
- [ ] Update complete route to persist diagnostics before final SSE event.
- [ ] Update complete route to persist backtest report before final SSE event.
- [ ] Update task event type to include optional `resultId` and `resultType`.
- [ ] Update diagnostics route response shape and list pagination.
- [ ] Add task and diagnostics route tests.
- [ ] Run API route tests.
- [ ] Commit: `feat: make task results recovery ready`.

---

### Phase 5: Worker Bridge and Python CLI Contract

#### Task 7: Update Worker handlers to pass ConfigSnapshot and fail closed

**Goal:** Worker 将 API task payload 无漂移地转成 Python CLI request；删除 diagnostics echo fallback。

**Files:**
- Modify: `apps/worker/src/types.ts`
- Modify: `apps/worker/src/handlers/diagnostics-handler.ts`
- Modify: `apps/worker/src/handlers/backtest-handler.ts`
- Modify: `apps/worker/src/python-bridge.ts`
- Modify: `apps/worker/src/main.ts`
- Modify/Create: `apps/worker/tests/diagnostics-handler.test.ts`
- Modify: `apps/worker/tests/backtest-handler.test.ts`

**Input/Output Interfaces:**
- Consumes: API `TaskRecord.payload` with target `configSnapshot`.
- Produces: Python CLI request from section 1.6.
- Forwards: `progress/log` events to API internal event endpoint.

**Test Method:**
- `cd apps/worker && pnpm test -- tests/diagnostics-handler.test.ts tests/backtest-handler.test.ts`
- Mock `PythonBridge.streamCall` to capture request and return success/error.

**Acceptance Criteria:**
- Backtest handler never reads `payload.params`.
- Diagnostics handler passes `configSnapshot`, `dataRange`, and no legacy `config.strategyParams` wrapper as the canonical request.
- Diagnostics `UNKNOWN_COMMAND` or `{ok:false}` throws and marks task failed through Worker main.
- Worker `TaskType` enum and `main.ts createHandler()` are reconciled: either implement handlers for declared `factor_compute/factor_eval/ai_train`, or remove/mark them unsupported at API validation before they reach Worker.
- Progress/log forwarding remains compatible with API internal route.

**Dependencies:** Task 6.

**Steps:**
- [ ] Update worker types for `ConfigSnapshot`, diagnostics payload, backtest payload, and result event.
- [ ] Rewrite diagnostics handler request builder to target CLI request.
- [ ] Remove echo fallback branches from diagnostics handler.
- [ ] Rewrite backtest handler request builder to target CLI request.
- [ ] Reconcile worker declared task types with actual `createHandler()` support; add tests that unsupported types are rejected before Worker polling or have concrete handlers.
- [ ] Update tests for captured Python request shapes.
- [ ] Run worker handler tests.
- [ ] Commit: `feat: pass config snapshots through worker bridge`.

#### Task 8: Add Python CLI diagnostics command and backtest configSnapshot support

**Goal:** Python CLI 接收 target `configSnapshot` contract，返回规范 NDJSON result/error。

**Files:**
- Modify: `packages/strategy-runtime/quantforge_strategy/cli.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/backtest.py`
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/__init__.py`
- Modify/Create: `packages/strategy-runtime/tests/test_cli.py`
- Create: `packages/strategy-runtime/tests/test_diagnostics_command.py`
- Modify: `packages/strategy-runtime/tests/test_backtest_command_market_rules.py`

**Input/Output Interfaces:**
- Consumes CLI requests from section 1.6.
- Produces NDJSON progress/log/result/error events.

**Test Method:**
- `cd packages/strategy-runtime && pytest tests/test_cli.py tests/test_diagnostics_command.py tests/test_backtest_command_market_rules.py -v`
- CLI subprocess test for `{"command":"diagnostics",...}` returns `event: result` or known `NO_DATA` error, not `UNKNOWN_COMMAND`.
- Backtest command unit test verifies `configSnapshot.params` is passed to strategy construction.

**Acceptance Criteria:**
- `_COMMANDS` includes `diagnostics`.
- `backtest.py` supports target `configSnapshot` and execution fields while retaining compatibility with current `config.strategyParams` only inside a clearly marked compatibility path.
- `diagnostics.py` dispatches by `configSnapshot.category` and `configSnapshot.subcategory`.
- Unknown category/subcategory returns `INVALID_CONFIG_SNAPSHOT` error event.
- No command writes non-JSON diagnostic text to stdout.

**Dependencies:** Task 7.

**Steps:**
- [ ] Add CLI command registration for `diagnostics`.
- [ ] Add request parsing helpers for `configSnapshot`, `execution`, and `dataRange`.
- [ ] Update backtest command to use `configSnapshot.params` as strategy params.
- [ ] Create diagnostics dispatcher with category/subcategory validation.
- [ ] Add CLI tests for diagnostics command dispatch and invalid snapshots.
- [ ] Run Python CLI tests.
- [ ] Commit: `feat: add diagnostics cli contract`.

---

### Phase 6: Python Diagnostics Algorithms

#### Task 9: Implement factor_based diagnostics

**Goal:** 因子型诊断输出 IC 序列、分层收益、因子相关性矩阵。

**Files:**
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/factor.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Create/Modify: `packages/strategy-runtime/tests/test_diagnostics_factor.py`

**Input/Output Interfaces:**
- Consumes: factor_based `ConfigSnapshot.params.factor_pool`, `dataRange` bars/factor data.
- Produces: `FactorDiagnosticsResult` from section 1.7.

**Test Method:**
- `cd packages/strategy-runtime && pytest tests/test_diagnostics_factor.py -v`
- Fixture with deterministic bars and two factors.

**Acceptance Criteria:**
- Computes forward returns and IC/rankIC over documented windows from Phase 0 spec.
- Returns layered returns for the documented group count.
- Returns symmetric correlation matrix with labels matching factor order.
- Emits progress at load, compute IC, layered returns, correlation, complete stages.
- Returns `NO_FACTOR_DATA` or `NO_PRICE_DATA` error for missing required data.

**Dependencies:** Task 0, Task 8.

**Steps:**
- [ ] Implement data loading adapter for price/factor input defined in Phase 0.
- [ ] Implement IC/rankIC calculation.
- [ ] Implement layered returns calculation.
- [ ] Implement correlation matrix calculation.
- [ ] Add deterministic unit tests for all fields.
- [ ] Run factor diagnostics tests.
- [ ] Commit: `feat: implement factor diagnostics`.

#### Task 10: Implement non_factor diagnostics

**Goal:** 非因子型诊断输出参数敏感性、信号质量、滑点压力测试。

**Files:**
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/non_factor.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Create/Modify: `packages/strategy-runtime/tests/test_diagnostics_non_factor.py`

**Input/Output Interfaces:**
- Consumes: non_factor `ConfigSnapshot.params`, `dataRange`, strategy registry.
- Produces: `NonFactorDiagnosticsResult` from section 1.7.

**Test Method:**
- `cd packages/strategy-runtime && pytest tests/test_diagnostics_non_factor.py -v`
- Fixture with deterministic dual MA bars and param grid.

**Acceptance Criteria:**
- Parameter sensitivity uses documented grid from Phase 0 and caps total runs to documented max.
- Signal quality includes total signals, win rate, average holding bars, profit factor, max consecutive losses.
- Slippage stress evaluates documented bps grid.
- Emits progress per stage.
- Returns structured error when strategy cannot produce signals for diagnostics.

**Dependencies:** Task 0, Task 8.

**Steps:**
- [ ] Implement parameter grid generation from `StrategyParamDef.range` and Phase 0 limits.
- [ ] Implement simplified backtest/signal collection adapter.
- [ ] Implement signal quality statistics.
- [ ] Implement slippage stress loop.
- [ ] Add deterministic unit tests for trend_cta example.
- [ ] Run non-factor diagnostics tests.
- [ ] Commit: `feat: implement non-factor diagnostics`.

#### Task 11: Implement transitional/event_sentiment_factor diagnostics

**Goal:** 过渡型诊断围绕“事件/舆情 → 标准化因子映射 → 挂载到因子库”输出情感衰减、映射目标、标准化因子质量、映射验证。

**Files:**
- Create: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics/transitional.py`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/diagnostics.py`
- Create/Modify: `packages/strategy-runtime/tests/test_diagnostics_transitional.py`

**Input/Output Interfaces:**
- Consumes: transitional `ConfigSnapshot.params.data_source`, `sentiment_decay_half_life`, `target_factor_pool`, event/sentiment records, price/factor data.
- Produces: `TransitionalDiagnosticsResult` from section 1.7.

**Test Method:**
- `cd packages/strategy-runtime && pytest tests/test_diagnostics_transitional.py -v`
- Fixture with deterministic event sentiment series, target factor series, and forward returns.

**Acceptance Criteria:**
- Does not return only data-source completeness.
- Computes sentiment decay curve for documented half-life candidates.
- Computes mapping target metrics for target factors.
- Computes standardized factor quality metrics: missing_ratio, outlier_ratio, mean, std, rank_ic, monotonicity.
- Computes mapping validation checks: lead_lag, cross_sectional_coverage, factor_library_attach, decay_robustness.
- Fails with `NO_EVENT_SENTIMENT_DATA` if source data is absent.

**Dependencies:** Task 0, Task 8.

**Steps:**
- [ ] Implement sentiment event loading adapter from Phase 0 spec.
- [ ] Implement exponential decay scoring.
- [ ] Implement standardization and outlier checks.
- [ ] Implement target factor mapping quality metrics.
- [ ] Implement mapping validation checks.
- [ ] Add deterministic unit tests for each output section.
- [ ] Run transitional diagnostics tests.
- [ ] Commit: `feat: implement event sentiment factor diagnostics`.

---

### Phase 7: Backtest End-to-End Contract and Report Result IDs

#### Task 12: Make backtest task use ConfigSnapshot only end-to-end

**Goal:** 回测任务从 API → Worker → Python → report persistence 全链路只使用 `configSnapshot`，并在 SSE 返回 report resultId。

**Files:**
- Modify: `apps/api/src/routes/task.ts`
- Modify: `apps/api/src/services/report-mapper.ts`
- Modify: `apps/worker/src/handlers/backtest-handler.ts`
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/backtest.py`
- Modify/Create: `apps/api/tests/routes/report.test.ts`
- Modify/Create: `apps/worker/tests/backtest-handler.test.ts`
- Modify/Create: `packages/strategy-runtime/tests/test_backtest_command_market_rules.py`

**Input/Output Interfaces:**
- Consumes: Backtest task payload from section 1.5.
- Produces: `BacktestTaskResult`, persisted `BacktestReportFull`, SSE result with `resultId` = report id and `resultType='backtest'`.

**Test Method:**
- `cd apps/worker && pnpm test -- tests/backtest-handler.test.ts`
- `cd apps/api && pnpm test -- tests/routes/report.test.ts tests/routes/task.test.ts`
- `cd packages/strategy-runtime && pytest tests/test_backtest_command_market_rules.py -v`

**Acceptance Criteria:**
- Backtest handler has no `payload.params` fallback.
- Python backtest command constructs strategy from `configSnapshot.params`.
- Report mapper includes config snapshot metadata in report data params or overview where appropriate.
- SSE result event includes top-level `resultId/resultType` after report save succeeds.
- Report save failure causes the task to fail; no raw backtest success without recoverable report `resultId`.

**Dependencies:** Task 6, Task 7, Task 8.

**Steps:**
- [ ] Remove top-level params from backtest API tests and types.
- [ ] Ensure Worker backtest request includes `configSnapshot` and execution fields.
- [ ] Ensure Python command uses `configSnapshot.params`.
- [ ] Save report before final task result event.
- [ ] Add tests for resultId/report id in SSE final event.
- [ ] Run API, Worker, Python backtest tests.
- [ ] Commit: `feat: use config snapshots for backtest tasks`.

---

### Phase 8: Frontend Consumer Alignment After Backend Contract Lands

#### Task 13: Update frontend API types and remove old taxonomy consumption

**Goal:** 前端只作为消费方对接新后端 contract；不再把旧 10 个 subcategory、ResearchMode、mock diagnostics 当目标依据。

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

**Input/Output Interfaces:**
- Consumes: API wire contracts from sections 1.2–1.5.
- Produces: frontend task submissions with `configSnapshot`, preview requests with chart-relevant params, real diagnostics rendering.

**Test Method:**
- `cd apps/web && pnpm test`
- TypeScript build: `cd apps/web && pnpm build`

**Acceptance Criteria:**
- `StrategySubcategory` frontend type matches the 10 target values from 06-28.
- `ResearchModeId` is not used for Strategy/Workspace classification.
- `useStrategies` consumes camelCase API response and does not need snake mapping for new fields.
- ConfigPanel saves full flattened `params` per category and stores returned `configSnapshot` hash.
- Workspace loads saved/default config on mount and submits diagnostics/backtest with that `configSnapshot`.
- Workspace renders diagnostics from API data when present; deterministic mock charts remain only as explicit empty/demo state, not as completed diagnostics.
- KlineChart consumes target preview shape or has a documented adapter at API boundary.

**Dependencies:** Task 1, Task 3, Task 5, Task 6.

**Steps:**
- [ ] Update frontend type unions to target subcategories.
- [ ] Update API client response/request types.
- [ ] Update ConfigPanel save payload to `{category, subcategory, params, expectedHash}`.
- [ ] Update WorkspacePage to fetch config snapshot before diagnostics/backtest.
- [ ] Update task stream result handling for top-level `resultId/resultType`.
- [ ] Update diagnostics rendering to consume backend result fields.
- [ ] Update preview adapter or KlineChart data types to target shape.
- [ ] Run frontend tests and build.
- [ ] Commit: `feat: align frontend consumers with backend strategy contract`.

---

## 4. DB Migration and Cleanup Strategy

1. **Read old rows first.** Before migration, read `strategy_configs`, `config_history`, and `diagnostic_results` from existing DB and produce an in-memory audit list.
2. **Safe enum renames.** Automatically rewrite:
   - `nonlinear_ml` → `ml_nonlinear_factor`
   - `high_frequency` → `hft_microstructure`
3. **Unsupported old enum values.** Do not silently rewrite `mean_reversion` or `tail_risk_hedging`. Migration must either:
   - quarantine those config/history rows into a JSON audit file under `data/migration-audits/`, or
   - fail startup with a clear error listing affected strategy names and row ids.
4. **Config shape upgrade.** Old `config_json` values that look like `{strategy, params, factorPool, preprocessing}` are normalized into one flat `params` object according to category rules.
5. **Diagnostics result migration.** Old diagnostic rows with only `id/taskId/strategy/configSnapshot/dataJson/createdAt` gain:
   - `result_id = id`
   - `result_type = 'diagnostics'`
   - `category/subcategory` from configSnapshot if valid, otherwise strategy registry meta
   - `engine_version = 'legacy'`
   - `expires_at = created_at + 7 days`
6. **Cleanup.** `DiagnosticService.purgeExpired(7)` runs on API startup and may also be called by a maintenance endpoint or scheduled script later.

---

## 5. Frontend 对接检查：当前期待 vs 后端目标差距

| Frontend file | Current expectation | Backend target impact | When to change |
|---|---|---|---|
| `apps/web/src/data/types.ts` | Subcategories include `nonlinear_ml/mean_reversion/high_frequency/tail_risk_hedging`; `ResearchModeId` still exists | Replace with 06-28 target; remove strategy classification dependence on ResearchMode | After Task 1 API output stable |
| `apps/web/src/hooks/useStrategies.ts` | Maps snake `chart_relevant/ui_constraints` to camel; sets `mode` from category cast to `ResearchModeId` | Consume camel API directly; no `mode` cast | After Task 1 |
| `apps/web/src/components/config-panel.tsx` | Saves nested mix `{strategy, params, factorPool, preprocessing, lookbackWindow...}` | Save full flattened `params` in `ConfigSnapshot` contract | After Task 3 |
| `apps/web/src/components/workspace-page.tsx` | Diagnostics submits empty params; backtest submits no configSnapshot; charts are deterministic mock | Fetch config first; submit configSnapshot; render real diagnostics by result `type` | After Task 6 and Task 9-11 |
| `apps/web/src/api/tasks.ts` | `ApiTaskType` excludes diagnostics; `TaskStreamEvent` has result only in `data` | Include diagnostics and top-level `resultId/resultType` | After Task 6 |
| `apps/web/src/api/diagnostics.ts` | Expects current `DiagnosticResult {id,dataJson}` | Consume `DiagnosticResultWire {resultId,data}` | After Task 6 |
| `apps/web/src/api/preview.ts` + `kline-chart.tsx` | Current frontend expects bars `timestamp/open/high/low/close/volume`, overlays `values`, signals `bar_index` | Either add frontend adapter or update KlineChart to 06-28 `{ts,o,h,l,c,v}` + overlay data points | After Task 5 |

**Important:** `workspace-page.tsx` deterministic chart generators and `det()` are UI placeholders only. They are not evidence that diagnostics, factor evaluation, signal quality, or backtest result rendering is complete.

---

## 6. Verification Commands by Layer

- Python runtime: `cd packages/strategy-runtime && pytest -v`
- Python strategies: `cd packages/strategies && pytest -v`
- API: `cd apps/api && pnpm test`
- Worker: `cd apps/worker && pnpm test`
- Frontend consumer: `cd apps/web && pnpm test && pnpm build`
- Full workspace smoke after all phases: `pnpm test && pnpm build`

---

## 7. User Decisions Applied

1. **Unsupported old subcategories:** `mean_reversion` and `tail_risk_hedging` are not in 06-28 and must not be silently mapped. Migration must quarantine/fail affected rows with an explicit audit list.
2. **Config GET when no saved config exists:** `GET /api/strategies/:name/config` returns `200 { persisted:false, configSnapshot: defaults }`, not 404.
3. **Config PUT request field name:** Canonical public request uses `params` to match `configSnapshot.params`. The legacy `{ config }` body may be accepted only as a short transition alias and must be covered by deprecation tests if implemented.
4. **ParamDef identity field:** Public wire uses `name` as canonical. `key` may appear only as deprecated transition output until frontend Task 13 lands.
5. **Preview compact bar shape:** Backend outputs strict 06-28 `{ts,o,h,l,c,v}` shape. Frontend adapts in Task 13; backend does not emit dual shapes.
6. **Hash conflict policy:** If client omits `expectedHash` and a config already exists, return 409. Omission is allowed only for first save/default insert.
7. **Transitional data sources:** Phase 0 starts from existing data-center event/announcement tables where possible. Missing sentiment fields must be explicit failure/degradation, not synthetic production data.
8. **Backtest report resultId policy:** If report persistence fails after Python backtest succeeds, the task fails. No successful backtest response without recoverable `resultId`.
9. **API DB vs data-center DB ownership:** Keep dual DB short-term, but document cross-write ordering and compensation. Do not assume cross-DB atomic transactions.
10. **workflowReady availability rule:** First version uses registered strategy + canonical category/subcategory + at least one active instrument with a minimum bar coverage for the default timeframe.
11. **Worker declared task types:** `factor_compute/factor_eval/ai_train` are explicitly rejected at API validation as out-of-scope for this backend sync unless a later plan expands scope.
12. **Synthetic diagnostics in dev:** Default off. If a dev-only mode is later added, responses must include `synthetic:true`; production diagnostics never uses synthetic fallback.
