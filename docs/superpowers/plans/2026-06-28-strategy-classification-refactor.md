# 策略分类体系重构 + 策略配置页面 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-06-28-strategy-classification-and-config-design.md](../specs/2026-06-28-strategy-classification-and-config-design.md)
**Goal:** 建立策略分类体系（Factor/Non-Factor/Transitional），重构前后端类型系统，新增策略配置页（KV线预览）+ Workspace 两步工作流，API 三层架构解耦。

**Architecture:** Phase 1 建立 Python 类型枚举和 TS 接口/DB 基础设施；Phase 2 实现 API 端点（Config CRUD、Preview、Diagnostics）；Phase 3 前端双页面（策略配置+Workspace）。每 Phase 内任务尽量并行。

**Tech Stack:** Python 3.11+ (dataclasses, Enum), TypeScript 5.9, React 19, Fastify, better-sqlite3 + Drizzle, CSS Modules

## Global Constraints

- 全量拍平，不采用增量差异（diff/patch）
- 回测引擎 runner.py 不做任何修改 — configSnapshot 是唯一真相源
- 现有 StrategyMeta.kind 保留；category/subcategory 为新增字段
- 因子评估标准（factor-development-standard.md）不变；ResearchMode 不删除
- API 层只做 HTTP 入口和轻量业务编排，不做回测计算
- 三层架构：Route → Service（依赖接口） → Repository（唯一认识 SQLite）
- 允许依赖：apps/api → services/data-center（已有白名单），无新增跨包依赖
- 遵循 KISS 原则，不做过度设计
- SQLite WAL 模式（data-center 已启用，API 侧补充 busy_timeout）
- 所有测试可独立运行（pytest -v / vitest）

---

## Phase 1: 类型 + 数据库 + 架构基础

### Task 1.1: Python 策略分类枚举

**Files:**
- Modify: `packages/strategy-runtime/quantforge_strategy/types.py`
- Modify: `packages/strategies/quantforge_strategies/registry.py`
- Create: `packages/strategy-runtime/tests/test_strategy_categories.py`

**Interfaces:**
- Produces: `StrategyCategory(str, Enum)`, `StrategySubcategory(str, Enum)` — 供所有 Python 策略消费
- Produces: `StrategyMeta.category`, `StrategyMeta.subcategory`, `StrategyMeta.factor_based` — 供回测引擎和 CLI 使用

- [ ] **Step 1: 在 types.py 中定义 StrategyCategory + StrategySubcategory 枚举**

```python
# packages/strategy-runtime/quantforge_strategy/types.py 末尾追加

class StrategyCategory(str, Enum):
    """一级策略分类"""
    FACTOR_BASED = "factor_based"
    NON_FACTOR = "non_factor"
    TRANSITIONAL = "transitional"


class StrategySubcategory(str, Enum):
    """二级策略分类"""
    # 因子型
    LINEAR_MULTI_FACTOR = "linear_multi_factor"
    INDEX_ENHANCEMENT = "index_enhancement"
    ML_NONLINEAR_FACTOR = "ml_nonlinear_factor"
    # 非因子型
    TREND_CTA = "trend_cta"
    ARBITRAGE = "arbitrage"
    HFT_MICROSTRUCTURE = "hft_microstructure"
    MACRO_QUANT = "macro_quant"
    EVENT_DRIVEN = "event_driven"
    E2E_AI_TIMESERIES = "e2e_ai_timeseries"
    # 过渡形态
    EVENT_SENTIMENT_FACTOR = "event_sentiment_factor"
```

- [ ] **Step 2: 在 StrategyMeta 中新增 category/subcategory 字段**

```python
# packages/strategy-runtime/quantforge_strategy/types.py
# StrategyMeta dataclass 中在 version 字段后追加:

@dataclass(frozen=True)
class StrategyMeta:
    name: str
    description: str
    modes: list[ResearchMode]
    params: list[StrategyParamDef]
    version: str
    # 🆕 新增字段
    category: StrategyCategory = StrategyCategory.NON_FACTOR
    subcategory: StrategySubcategory | None = None
    required_factors: list[str] | None = None
    kind: StrategyKind = StrategyKind.Combined

    @property
    def factor_based(self) -> bool:
        return self.category == StrategyCategory.FACTOR_BASED

    # 🆕 新增属性：是否可进入工作区（后端判断逻辑此处仅为默认值）
    @property
    def workflow_ready(self) -> bool:
        return True  # 默认值，具体判断在 API 策略同步时
```

- [ ] **Step 3: 为 StrategyParamDef 增加 chart_relevant 和 ui_constraints 字段**

```python
@dataclass(frozen=True)
class StrategyParamDef:
    key: str
    label: str
    type: ParamType
    default: Any
    min: float | None = None
    max: float | None = None
    options: list[str] | None = None
    # 🆕
    chart_relevant: bool = False
    ui_constraints: list[UIConstraint] | None = None


@dataclass(frozen=True)
class UIConstraint:
    """前端表单联动校验规则"""
    kind: str  # "require_when" | "disable_when" | "set_default_when" | "range_when"
    target_field: str
    target_value: Any
    action_value: Any | None = None
```

- [ ] **Step 4: 在 __init__.py 中导出新类型**

```python
# packages/strategy-runtime/quantforge_strategy/__init__.py 追加:
from .types import (
    # ...existing...
    StrategyCategory,
    StrategySubcategory,
    UIConstraint,
)
```

- [ ] **Step 5: 为存量策略添加 category/subcategory**

对所有 10 个注册策略逐一更新 meta：

```python
# packages/strategies/quantforge_strategies/combined/dual_ma.py — meta 中增加:
category=StrategyCategory.NON_FACTOR,
subcategory=StrategySubcategory.TREND_CTA,

# combined/rsi.py
category=StrategyCategory.NON_FACTOR,
subcategory=StrategySubcategory.TREND_CTA,

# combined/bollinger_band.py
category=StrategyCategory.NON_FACTOR,
subcategory=StrategySubcategory.TREND_CTA,

# combined/macd.py
category=StrategyCategory.NON_FACTOR,
subcategory=StrategySubcategory.TREND_CTA,

# combined/kdj.py
category=StrategyCategory.NON_FACTOR,
subcategory=StrategySubcategory.TREND_CTA,

# combined/ai_predictor.py
category=StrategyCategory.NON_FACTOR,
subcategory=StrategySubcategory.E2E_AI_TIMESERIES,

# selectors/momentum.py
category=StrategyCategory.FACTOR_BASED,
subcategory=StrategySubcategory.LINEAR_MULTI_FACTOR,

# timers/ma_crossover.py
category=StrategyCategory.NON_FACTOR,
subcategory=StrategySubcategory.TREND_CTA,

# sizers/equal_weight.py — 不添加（仓位策略不独立展示）

# sizers/fixed_fraction.py — 不添加
```

- [ ] **Step 6: 添加 ParamType.选择器参数 chart_relevant 标记**

```python
# dual_ma.py: fast/slow 参数加 chart_relevant=True
StrategyParamDef(key="fast_period", label="快线周期", type=ParamType.Number,
                 default=5, min=2, max=200, chart_relevant=True),
StrategyParamDef(key="slow_period", label="慢线周期", type=ParamType.Number,
                 default=20, min=5, max=300, chart_relevant=True),
```

- [ ] **Step 7: 写测试**

```python
# packages/strategy-runtime/tests/test_strategy_categories.py

def test_strategy_category_values():
    assert StrategyCategory.FACTOR_BASED == "factor_based"
    assert StrategyCategory.NON_FACTOR == "non_factor"
    assert StrategyCategory.TRANSITIONAL == "transitional"

def test_subcategory_values():
    assert StrategySubcategory.TREND_CTA == "trend_cta"
    assert StrategySubcategory.LINEAR_MULTI_FACTOR == "linear_multi_factor"
    assert StrategySubcategory.EVENT_SENTIMENT_FACTOR == "event_sentiment_factor"

def test_meta_factor_based_property():
    meta = StrategyMeta(
        name="test", description="", modes=[], params=[], version="0.1",
        category=StrategyCategory.FACTOR_BASED,
    )
    assert meta.factor_based is True
    assert meta.workflow_ready is True

def test_meta_default_category():
    meta = StrategyMeta(name="test", description="", modes=[], params=[], version="0.1")
    assert meta.category == StrategyCategory.NON_FACTOR

def test_param_ui_constraints():
    param = StrategyParamDef(
        key="industry_neutral", label="行业中性化", type=ParamType.Bool, default=False,
        chart_relevant=False,
        ui_constraints=[
            UIConstraint(kind="require_when", target_field="subcategory",
                         target_value="index_enhancement")
        ]
    )
    assert len(param.ui_constraints) == 1
    assert param.ui_constraints[0].kind == "require_when"
```

- [ ] **Step 8: 运行测试**

```bash
cd packages/strategy-runtime && python -m pytest tests/test_strategy_categories.py -v
```

- [ ] **Step 9: 验证存量策略兼容性**

```bash
cd packages/strategies && python -m pytest -v
```

- [ ] **Step 10: Commit**

```bash
git add packages/strategy-runtime/ packages/strategies/
git commit -m "feat: add StrategyCategory/Subcategory enums and extend StrategyMeta/ParamDef"
```

---

### Task 1.2: API 侧 TS 接口定义 + DB 表

**Files:**
- Create: `apps/api/src/repositories/interfaces.ts`
- Modify: `apps/api/src/storage/schema.ts`
- Modify: `apps/api/src/storage/connection.ts`

**Interfaces:**
- Produces: `IConfigRepo`, `IConfigHistoryRepo`, `IDiagnosticRepo`, `StrategyConfig`, `DiagnosticResult`, `ChartPreviewRequest`, `ChartPreviewResponse`
- Consumes: (none — first TS infrastructure task)

- [ ] **Step 1: 在 API types.ts 中新增 TaskType 枚举值**

```typescript
// apps/api/src/types.ts — TaskType 枚举扩展
export enum TaskType {
  Backtest = 'backtest',
  FactorCompute = 'factor_compute',
  FactorEval = 'factor_eval',
  AITrain = 'ai_train',
  Collect = 'collect',
  Diagnostics = 'diagnostics',   // 🆕
}
```

- [ ] **Step 2: 在 API types.ts 中新增策略分类类型**

```typescript
// apps/api/src/types.ts — 追加
export type StrategyCategory = 'factor_based' | 'non_factor' | 'transitional';

export type StrategySubcategory =
  | 'linear_multi_factor' | 'index_enhancement' | 'ml_nonlinear_factor'
  | 'trend_cta' | 'arbitrage' | 'hft_microstructure' | 'macro_quant'
  | 'event_driven' | 'e2e_ai_timeseries'
  | 'event_sentiment_factor';

export interface StrategyConfig {
  category: StrategyCategory;
  subcategory: StrategySubcategory;
  params: Record<string, unknown>;
}

export interface ConfigSnapshot extends StrategyConfig {
  hash: string;
}
```

- [ ] **Step 3: 创建 Repository 接口文件**

```typescript
// apps/api/src/repositories/interfaces.ts

import type { StrategyConfig, ConfigSnapshot } from '../types.js';

export interface IConfigRepo {
  get(strategyName: string): Promise<StrategyConfig | null>;
  save(strategyName: string, config: StrategyConfig, hash: string): Promise<void>;
}

export interface IConfigHistoryRepo {
  append(strategyName: string, config: StrategyConfig, hash: string): Promise<void>;
  list(strategyName: string, limit?: number): Promise<{ config: StrategyConfig; hash: string; createdAt: number }[]>;
}

export interface DiagnosticResult {
  resultId: string;
  strategyName: string;
  configSnapshot: ConfigSnapshot;
  data: unknown;
  createdAt: number;
}

export interface IDiagnosticRepo {
  save(result: DiagnosticResult): Promise<void>;
  getById(resultId: string): Promise<DiagnosticResult | null>;
  listByStrategy(strategyName: string, limit?: number): Promise<DiagnosticResult[]>;
  purgeOlderThan(days: number): Promise<number>;
}
```

- [ ] **Step 4: 更新 DB schema — 新增 3 张表**

```typescript
// apps/api/src/storage/schema.ts — 追加

export const strategyConfigs = sqliteTable('strategy_configs', {
  strategyName: text('strategy_name').primaryKey(),
  configJson: text('config_json').notNull(),
  hash: text('hash').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const configHistory = sqliteTable('config_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  strategyName: text('strategy_name').notNull(),
  configJson: text('config_json').notNull(),
  hash: text('hash').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  idxConfigHistory: index('idx_config_history_strategy').on(table.strategyName, sql`${table.createdAt} DESC`),
}));

export const diagnosticResults = sqliteTable('diagnostic_results', {
  resultId: text('result_id').primaryKey(),
  strategyName: text('strategy_name').notNull(),
  configSnapshot: text('config_snapshot').notNull(),
  dataJson: text('data_json').notNull(),
  createdAt: integer('created_at').notNull(),
}, (table) => ({
  idxDiagStrategy: index('idx_diag_strategy_created').on(table.strategyName, sql`${table.createdAt} DESC`),
}));
```

- [ ] **Step 5: 更新 connection.ts — WAL + busy_timeout**

```typescript
// apps/api/src/storage/connection.ts

// 在 initApiDb() 内，创建 database 后追加:
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');
```

- [ ] **Step 6: 验证 schema 无 lint 错误**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/types.ts apps/api/src/repositories/interfaces.ts apps/api/src/storage/schema.ts apps/api/src/storage/connection.ts
git commit -m "feat: add TS interfaces, DB schema for config/diagnostics, and WAL mode for API SQLite"
```

---

### Task 1.3: Repository 实现 + Service 层 + 三层架构接线

**Files:**
- Create: `apps/api/src/repositories/sqlite-config-repo.ts`
- Create: `apps/api/src/repositories/sqlite-diag-repo.ts`
- Create: `apps/api/src/services/config-service.ts`
- Create: `apps/api/src/services/diagnostic-service.ts`
- Modify: `apps/api/src/index.ts` (组合根)
- Modify: `apps/api/src/app.ts` (Fastify decorate)

**Interfaces:**
- Consumes: `IConfigRepo`, `IConfigHistoryRepo`, `IDiagnosticRepo` (Task 1.2)
- Produces: `SqliteConfigRepo`, `SqliteDiagnosticRepo`, `StrategyConfigService`, `DiagnosticService`

- [ ] **Step 1: 实现 SqliteConfigRepo**

```typescript
// apps/api/src/repositories/sqlite-config-repo.ts

import type { IConfigRepo, IConfigHistoryRepo } from './interfaces.js';
import type { StrategyConfig } from '../types.js';
import { getApiDb } from '../storage/connection.js';
import { strategyConfigs } from '../storage/schema.js';
import { eq } from 'drizzle-orm';

export class SqliteConfigRepo implements IConfigRepo {
  constructor(private history: IConfigHistoryRepo) {}

  async get(strategyName: string): Promise<StrategyConfig | null> {
    const db = getApiDb();
    const row = db.select().from(strategyConfigs)
      .where(eq(strategyConfigs.strategyName, strategyName)).get();
    if (!row) return null;
    return JSON.parse(row.configJson) as StrategyConfig;
  }

  async save(strategyName: string, config: StrategyConfig, hash: string): Promise<void> {
    const db = getApiDb();
    const configJson = JSON.stringify(config);
    db.insert(strategyConfigs)
      .values({ strategyName, configJson, hash, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: strategyConfigs.strategyName,
        set: { configJson: configJson, hash, updatedAt: Date.now() }
      })
      .run();
    // 透明写入历史 — Service 不感知
    await this.history.append(strategyName, config, hash);
  }
}

// ConfigHistoryRepo — 仅被 ConfigRepo 内部持有
export class SqliteConfigHistoryRepo implements IConfigHistoryRepo {
  async append(strategyName: string, config: StrategyConfig, hash: string): Promise<void> {
    const db = getApiDb();
    const { configHistory } = await import('../storage/schema.js');
    db.insert(configHistory)
      .values({ strategyName, configJson: JSON.stringify(config), hash, createdAt: Date.now() })
      .run();
  }

  async list(strategyName: string, limit: number = 20) {
    const db = getApiDb();
    const { configHistory } = await import('../storage/schema.js');
    const rows = db.select().from(configHistory)
      .where(eq(configHistory.strategyName, strategyName))
      .orderBy(sql`${configHistory.createdAt} DESC`)
      .limit(limit)
      .all();
    return rows.map(r => ({
      config: JSON.parse(r.configJson) as StrategyConfig,
      hash: r.hash,
      createdAt: r.createdAt,
    }));
  }
}
```

- [ ] **Step 2: 实现 SqliteDiagnosticRepo**

```typescript
// apps/api/src/repositories/sqlite-diag-repo.ts

import type { IDiagnosticRepo, DiagnosticResult } from './interfaces.js';
import { getApiDb } from '../storage/connection.js';
import { diagnosticResults } from '../storage/schema.js';
import { eq, and, lt, sql } from 'drizzle-orm';

export class SqliteDiagnosticRepo implements IDiagnosticRepo {
  async save(result: DiagnosticResult): Promise<void> {
    const db = getApiDb();
    db.insert(diagnosticResults).values({
      resultId: result.resultId,
      strategyName: result.strategyName,
      configSnapshot: JSON.stringify(result.configSnapshot),
      dataJson: JSON.stringify(result.data),
      createdAt: result.createdAt,
    }).run();
  }

  async getById(resultId: string): Promise<DiagnosticResult | null> {
    const db = getApiDb();
    const row = db.select().from(diagnosticResults)
      .where(eq(diagnosticResults.resultId, resultId)).get();
    if (!row) return null;
    return {
      resultId: row.resultId,
      strategyName: row.strategyName,
      configSnapshot: JSON.parse(row.configSnapshot),
      data: JSON.parse(row.dataJson),
      createdAt: row.createdAt,
    };
  }

  async listByStrategy(strategyName: string, limit: number = 20): Promise<DiagnosticResult[]> {
    const db = getApiDb();
    const rows = db.select().from(diagnosticResults)
      .where(eq(diagnosticResults.strategyName, strategyName))
      .orderBy(sql`${diagnosticResults.createdAt} DESC`)
      .limit(limit)
      .all();
    return rows.map(r => ({
      resultId: r.resultId,
      strategyName: r.strategyName,
      configSnapshot: JSON.parse(r.configSnapshot),
      data: JSON.parse(r.dataJson),
      createdAt: r.createdAt,
    }));
  }

  async purgeOlderThan(days: number): Promise<number> {
    const db = getApiDb();
    const cutoff = Date.now() - days * 86400_000;
    const result = db.delete(diagnosticResults)
      .where(lt(diagnosticResults.createdAt, cutoff))
      .run();
    return result.changes;
  }
}
```

- [ ] **Step 3: 实现 StrategyConfigService**

```typescript
// apps/api/src/services/config-service.ts

import type { IConfigRepo } from '../repositories/interfaces.js';
import type { StrategyConfig } from '../types.js';

export class StrategyConfigService {
  constructor(private configRepo: IConfigRepo) {}

  async getConfig(strategyName: string): Promise<StrategyConfig | null> {
    return this.configRepo.get(strategyName);
  }

  async saveConfig(strategyName: string, config: StrategyConfig, hash: string): Promise<{ saved: boolean; hash: string }> {
    await this.configRepo.save(strategyName, config, hash);
    return { saved: true, hash };
  }
}
```

- [ ] **Step 4: 实现 DiagnosticService**

```typescript
// apps/api/src/services/diagnostic-service.ts

import type { IDiagnosticRepo, DiagnosticResult } from '../repositories/interfaces.js';
import type { ConfigSnapshot } from '../types.js';
import { randomUUID } from 'node:crypto';

export class DiagnosticService {
  constructor(private diagRepo: IDiagnosticRepo) {}

  async getById(resultId: string): Promise<DiagnosticResult | null> {
    return this.diagRepo.getById(resultId);
  }

  async listByStrategy(strategyName: string): Promise<DiagnosticResult[]> {
    return this.diagRepo.listByStrategy(strategyName, 20);
  }

  async storeResult(
    strategyName: string,
    configSnapshot: ConfigSnapshot,
    data: unknown,
  ): Promise<string> {
    const resultId = randomUUID();
    await this.diagRepo.save({
      resultId,
      strategyName,
      configSnapshot,
      data,
      createdAt: Date.now(),
    });
    return resultId;
  }

  async purgeExpired(days: number = 7): Promise<number> {
    return this.diagRepo.purgeOlderThan(days);
  }
}
```

- [ ] **Step 5: 在 index.ts 组合根中接线**

```typescript
// apps/api/src/index.ts — 在 buildApp() 之前追加:

import { SqliteConfigRepo, SqliteConfigHistoryRepo } from './repositories/sqlite-config-repo.js';
import { SqliteDiagnosticRepo } from './repositories/sqlite-diag-repo.js';
import { StrategyConfigService } from './services/config-service.js';
import { DiagnosticService } from './services/diagnostic-service.js';

// ... 现有 dataCenter + taskService 初始化之后:

const configHistoryRepo = new SqliteConfigHistoryRepo();
const configRepo = new SqliteConfigRepo(configHistoryRepo);
const diagRepo = new SqliteDiagnosticRepo();

const configService = new StrategyConfigService(configRepo);
const diagnosticService = new DiagnosticService(diagRepo);
```

- [ ] **Step 6: 更新 AppOptions 和 Fastify decorate**

```typescript
// apps/api/src/app.ts

import type { StrategyConfigService } from './services/config-service.js';
import type { DiagnosticService } from './services/diagnostic-service.js';

export interface AppOptions {
  dataCenter: DataCenter;
  taskService: TaskService;
  configService: StrategyConfigService;      // 🆕
  diagnosticService: DiagnosticService;      // 🆕
}

// 在 buildApp 函数内:
app.decorate('configService', opts.configService);
app.decorate('diagnosticService', opts.diagnosticService);
```

- [ ] **Step 7: 类型检查和编译**

```bash
cd apps/api && npx tsc --noEmit && npx tsc
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/
git commit -m "feat: implement config/diagnostic repos + services, wire 3-layer architecture in composition root"
```

---

## Phase 2: API 端点全量

### Task 2.1: Config CRUD 端点 (GET/PUT)

**Files:**
- Create: `apps/api/src/routes/config.ts`
- Modify: `apps/api/src/app.ts` (注册路由)

**Interfaces:**
- Consumes: `configService` (Task 1.3)
- Produces: `GET /api/strategies/:name/config`, `PUT /api/strategies/:name/config`

- [ ] **Step 1: 创建 config 路由**

```typescript
// apps/api/src/routes/config.ts

import type { FastifyInstance } from 'fastify';

export async function configRoutes(app: FastifyInstance) {
  // GET /api/strategies/:name/config
  app.get('/api/strategies/:name/config', async (request, reply) => {
    const { name } = request.params as { name: string };
    const configService = app.configService;
    const config = await configService.getConfig(name);
    if (!config) {
      return reply.status(404).send({ error: 'Config not found' });
    }
    return config;
  });

  // PUT /api/strategies/:name/config
  app.put('/api/strategies/:name/config', async (request, reply) => {
    const { name } = request.params as { name: string };
    const { config, hash } = request.body as { config: unknown; hash: string };
    const configService = app.configService;
    const result = await configService.saveConfig(name, config as any, hash);
    return reply.status(201).send(result);
  });
}
```

- [ ] **Step 2: 在 app.ts 中注册路由**

```typescript
// apps/api/src/app.ts — 在现有路由注册块中追加:
app.register(configRoutes);
```

- [ ] **Step 3: 手动 curl 验证**

```bash
# 启动 API
pnpm --filter @quant/api dev
# 另开终端
curl http://localhost:3002/api/strategies/dual_ma/config
# 预期: 404 (未保存过)
curl -X PUT http://localhost:3002/api/strategies/dual_ma/config \
  -H "Content-Type: application/json" \
  -d '{"config":{"category":"non_factor","subcategory":"trend_cta","params":{"fast":5}},"hash":"abc"}'
# 预期: 201 {"saved":true,"hash":"abc"}
curl http://localhost:3002/api/strategies/dual_ma/config
# 预期: 200, 返回保存的 config
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/config.ts apps/api/src/app.ts
git commit -m "feat: add GET/PUT /api/strategies/:name/config endpoints"
```

---

### Task 2.2: GET /api/strategies 扩展 + strategy-sync 适配

**Files:**
- Modify: `apps/api/src/routes/strategy.ts`
- Modify: `apps/api/src/services/strategy-sync.ts`

**Interfaces:**
- Consumes: `dataCenter` (taskService)
- Produces: 扩展 `GET /api/strategies` 返回 category/subcategory/workflowReady

- [ ] **Step 1: 扩展 strategy 路由的响应映射**

```typescript
// apps/api/src/routes/strategy.ts — 在 syncFromPython 后追加映射:

// 在返回的策略列表中，对每个 strategy 追加:
const result = synced.map((s: any) => ({
  ...s,
  category: s.category || 'non_factor',
  subcategory: s.subcategory || null,
  workflowReady: s.backtestable && s.category !== undefined,
  params: (s.params || []).map((p: any) => ({
    ...p,
    chartRelevant: p.chartRelevant || false,
    uiConstraints: p.uiConstraints || null,
  })),
}));
```

- [ ] **Step 2: 更新 strategy-sync service 解析新字段**

```typescript
// apps/api/src/services/strategy-sync.ts — 在 JSON 解析后确保新字段存在:

// Python 子进程返回的 meta JSON 可能不含新字段，添加默认值:
const defaults = {
  category: 'non_factor',
  subcategory: null,
  requiredFactors: null,
};
// merge defaults into each parsed strategy
```

- [ ] **Step 3: 验证**

```bash
curl http://localhost:3002/api/strategies | jq '.[0] | {name, category, subcategory, workflowReady}'
# 预期: 返回含新字段的策略列表
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/strategy.ts apps/api/src/services/strategy-sync.ts
git commit -m "feat: extend GET /api/strategies with category/subcategory/workflowReady"
```

---

### Task 2.3: Preview 端点 + TypeScript 轻量引擎

**Files:**
- Create: `apps/api/src/services/preview-service.ts`
- Create: `apps/api/src/routes/preview.ts`
- Modify: `apps/api/src/app.ts`

**Interfaces:**
- Consumes: `dataCenter.providers.market` (bars 查询)
- Produces: `POST /api/strategies/:name/preview`

- [ ] **Step 1: 实现 PreviewService（TypeScript 轻量引擎）**

```typescript
// apps/api/src/services/preview-service.ts

import { createHash } from 'node:crypto';

interface PreviewParams {
  lookback_window?: number;
  indicators?: string[];
  macd_fast?: number;
  macd_slow?: number;
  macd_signal?: number;
  rsi_period?: number;
  [key: string]: unknown;
}

interface Bar {
  ts: number; o: number; h: number; l: number; c: number; v: number;
}

interface Overlay {
  type: 'line' | 'marker';
  label: string;
  data: { ts: number; value?: number; kind?: string }[];
  style?: { color: string; width: number };
}

interface Signal {
  ts: number; side: 'buy' | 'sell'; price: number;
  reason: string; factor_snapshot: null;
}

export class PreviewService {
  /**
   * 纯 TypeScript 计算指标叠加层和虚拟信号。
   * 不依赖 Python — 算法偏差由前端免责声明和 fingerprint 覆盖。
   */
  computePreview(
    bars: Bar[],
    params: PreviewParams,
  ): { overlays: Overlay[]; signals: Signal[]; fingerprint: string } {
    const closes = bars.map(b => b.c);
    const overlays: Overlay[] = [];
    const signals: Signal[] = [];

    // MA 叠加
    const lookback = params.lookback_window || 20;
    const maData = this._calcSMA(bars, lookback);
    overlays.push({
      type: 'line', label: `MA${lookback}`,
      data: maData,
      style: { color: '#f5a623', width: 1 },
    });

    // RSI
    if (params.indicators?.includes('rsi')) {
      const period = params.rsi_period || 14;
      const rsiData = this._calcRSI(closes, period);
      overlays.push({
        type: 'line', label: `RSI(${period})`,
        data: rsiData.map((v, i) => ({ ts: bars[i]?.ts, value: v })),
        style: { color: '#7c4dff', width: 1 },
      });
      // 超买超卖信号
      for (let i = 1; i < rsiData.length; i++) {
        if (rsiData[i - 1] >= 30 && rsiData[i] < 30) {
          signals.push({ ts: bars[i].ts, side: 'buy', price: bars[i].c,
            reason: `RSI<30 超卖`, factor_snapshot: null });
        }
        if (rsiData[i - 1] <= 70 && rsiData[i] > 70) {
          signals.push({ ts: bars[i].ts, side: 'sell', price: bars[i].c,
            reason: `RSI>70 超买`, factor_snapshot: null });
        }
      }
    }

    // MACD
    if (params.indicators?.includes('macd')) {
      const fast = params.macd_fast || 12;
      const slow = params.macd_slow || 26;
      const signal = params.macd_signal || 9;
      const emaFast = this._calcEMA(closes, fast);
      const emaSlow = this._calcEMA(closes, slow);
      const dif = emaFast.map((v, i) => v - emaSlow[i]);
      const dea = this._calcEMA(dif, signal);
      const macd = dif.map((v, i) => (v - dea[i]) * 2);

      overlays.push({
        type: 'line', label: 'MACD DIF',
        data: dif.map((v, i) => ({ ts: bars[i]?.ts, value: v })),
        style: { color: '#2196f3', width: 1 },
      });
      overlays.push({
        type: 'line', label: 'MACD DEA',
        data: dea.map((v, i) => ({ ts: bars[i]?.ts, value: v })),
        style: { color: '#ff9800', width: 1 },
      });

      // 金叉死叉标记
      for (let i = 1; i < dif.length; i++) {
        if (dif[i - 1] <= dea[i - 1] && dif[i] > dea[i]) {
          overlays.push({ type: 'marker', label: 'MACD Cross',
            data: [{ ts: bars[i].ts, kind: 'golden_cross' }],
            style: { color: '#4caf50', width: 2 } });
          signals.push({ ts: bars[i].ts, side: 'buy', price: bars[i].c,
            reason: 'MACD 金叉', factor_snapshot: null });
        }
        if (dif[i - 1] >= dea[i - 1] && dif[i] < dea[i]) {
          overlays.push({ type: 'marker', label: 'MACD Cross',
            data: [{ ts: bars[i].ts, kind: 'death_cross' }],
            style: { color: '#f44336', width: 2 } });
          signals.push({ ts: bars[i].ts, side: 'sell', price: bars[i].c,
            reason: 'MACD 死叉', factor_snapshot: null });
        }
      }
    }

    // fingerprint: hash(参数 + 最后 10 根 K 线收盘价)
    const hash = createHash('sha256')
      .update(JSON.stringify(params))
      .update(JSON.stringify(closes.slice(-10)))
      .digest('hex').slice(0, 16);

    return { overlays, signals, fingerprint: `sha256:${hash}` };
  }

  private _calcSMA(bars: Bar[], period: number) {
    const result: { ts: number; value: number }[] = [];
    let sum = 0;
    for (let i = 0; i < bars.length; i++) {
      sum += bars[i].c;
      if (i >= period) sum -= bars[i - period].c;
      if (i >= period - 1) result.push({ ts: bars[i].ts, value: sum / period });
    }
    return result;
  }

  private _calcEMA(data: number[], period: number) {
    const k = 2 / (period + 1);
    const result: number[] = [];
    for (let i = 0; i < data.length; i++) {
      if (i === 0) result.push(data[i]);
      else result.push(data[i] * k + result[i - 1] * (1 - k));
    }
    return result;
  }

  private _calcRSI(closes: number[], period: number) {
    const result: number[] = new Array(closes.length).fill(NaN);
    let avgGain = 0, avgLoss = 0;
    for (let i = 1; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (i < period) {
        if (change > 0) avgGain += change;
        else avgLoss -= change;
        if (i === period - 1) {
          avgGain /= period; avgLoss /= period;
          result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
        }
      } else {
        avgGain = (avgGain * (period - 1) + Math.max(change, 0)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.max(-change, 0)) / period;
        result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    }
    return result;
  }
}
```

- [ ] **Step 2: 创建 preview 路由**

```typescript
// apps/api/src/routes/preview.ts

import type { FastifyInstance } from 'fastify';
import { PreviewService } from '../services/preview-service.js';

export async function previewRoutes(app: FastifyInstance) {
  const previewService = new PreviewService();

  app.post('/api/strategies/:name/preview', async (request, reply) => {
    const { symbol, timeframe, cursor, limit = 500, preview_params } = request.body as {
      symbol: string; timeframe: string; cursor: number | null;
      limit?: number; preview_params: Record<string, unknown>;
    };

    // 从 dataCenter 查 K 线
    const bars = await app.dataCenter.providers.market.loadBars({
      symbol, timeframe,
      end: cursor ? new Date(cursor * 1000) : undefined,
      limit,
    });

    // 计算叠加层和信号
    const { overlays, signals, fingerprint } = previewService.computePreview(
      bars.map((b: any) => ({ ts: b.timestamp, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume })),
      preview_params,
    );

    const hasMore = bars.length === limit;
    const nextCursor = hasMore && bars.length > 0 ? bars[bars.length - 1].timestamp : null;

    return {
      symbol,
      bars: bars.map((b: any) => ({ ts: b.timestamp, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume })),
      overlays,
      signals,
      pagination: { has_more: hasMore, next_cursor: nextCursor, total_count: null },
      fingerprint,
      engine_version: '1.0.0',
    };
  });
}
```

- [ ] **Step 3: 在 app.ts 中注册路由**

```typescript
// apps/api/src/app.ts
app.register(previewRoutes);
```

- [ ] **Step 4: 类型检查**

```bash
cd apps/api && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/preview-service.ts apps/api/src/routes/preview.ts apps/api/src/app.ts
git commit -m "feat: add POST /api/strategies/:name/preview endpoint with TS preview engine"
```

---

### Task 2.4: POST /api/tasks 改造 — configSnapshot 为唯一真相源

**Files:**
- Modify: `apps/api/src/routes/task.ts`
- Modify: `apps/worker/src/handlers/backtest-handler.ts`
- Modify: `apps/worker/src/agents/backtest-agent.ts`

- [ ] **Step 1: 从 task 路由的 POST body 中移除顶层 params**

```typescript
// apps/api/src/routes/task.ts — POST /api/tasks 处理:

// 原: const { type, payload } = request.body;
// 改为显式提取 configSnapshot:
const { type, payload } = request.body as { type: string; payload: any };
// payload.params 不再被路由使用 — 参数统一来自 payload.configSnapshot
```

- [ ] **Step 2: 更新 backtest-handler 从 configSnapshot 提取参数**

```typescript
// apps/worker/src/handlers/backtest-handler.ts

// 在构建 Python CLI 命令时:
const configSnapshot = payload.configSnapshot || {};
const params = configSnapshot.params || {};

// 现有 params 逻辑全部迁移到从 configSnapshot.params 读取
const config = {
  initialCash: payload.initialCash,
  slippage: payload.slippage,
  ...params,   // 从 configSnapshot 提取策略参数
};
```

- [ ] **Step 3: 更新 backtest-agent 适配 configSnapshot**

```typescript
// apps/worker/src/agents/backtest-agent.ts

// 在格式化回测请求的地方，params 来源改为 configSnapshot:
const args = {
  command: "backtest",
  strategy: payload.strategy,
  config: {
    initialCash: payload.initialCash ?? DEFAULT_INITIAL_CASH,
    slippage: payload.slippage ?? DEFAULT_SLIPPAGE,
    ...(payload.configSnapshot?.params || {}),
  },
  dataRange: { /* ... */ },
};
```

- [ ] **Step 4: 验证回测仍可运行**

```bash
# 提交一个回测任务
curl -X POST http://localhost:3002/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"type":"backtest","payload":{"strategy":"dual_ma","symbol":"600519","timeframe":"1d","initialCash":100000,"configSnapshot":{"category":"non_factor","subcategory":"trend_cta","params":{"fast_period":5,"slow_period":20}}}}'
# 预期: 202 {"id":"...","status":"pending"}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/task.ts apps/worker/src/handlers/backtest-handler.ts apps/worker/src/agents/backtest-agent.ts
git commit -m "fix: make configSnapshot the single source of truth, remove top-level params from POST /api/tasks"
```

---

### Task 2.5: Diagnostics 端点 + SSE result_id 扩展

**Files:**
- Create: `apps/api/src/routes/diagnostics.ts`
- Modify: `apps/api/src/routes/task.ts` (SSE complete 事件下发 result_id)
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: 创建 diagnostics 路由**

```typescript
// apps/api/src/routes/diagnostics.ts

export async function diagnosticRoutes(app: FastifyInstance) {
  // GET /api/diagnostics/:resultId
  app.get('/api/diagnostics/:resultId', async (request, reply) => {
    const { resultId } = request.params as { resultId: string };
    const result = await app.diagnosticService.getById(resultId);
    if (!result) return reply.status(404).send({ error: 'Diagnostic result not found' });
    return result;
  });

  // GET /api/diagnostics?strategy=xxx
  app.get('/api/diagnostics', async (request, reply) => {
    const { strategy } = request.query as { strategy?: string };
    if (!strategy) return reply.status(400).send({ error: 'strategy query param required' });
    const results = await app.diagnosticService.listByStrategy(strategy);
    return results;
  });
}
```

- [ ] **Step 2: 在 task 路由 SSE complete 事件中下发 result_id**

```typescript
// apps/api/src/routes/task.ts — complete 处理中:

// 对于诊断类型的任务，存储并下发 result_id:
if (task.type === 'diagnostics' && task.result) {
  const resultId = await app.diagnosticService.storeResult(
    task.payload.strategy,
    task.payload.configSnapshot,
    task.result,
  );
  // 将 result_id 附加到 SSE result 事件体中
  sseEvent.data = JSON.stringify({
    type: 'result',
    taskId: task.id,
    resultId,          // 🆕
    resultType: 'diagnostics',
    data: task.result,
  });
}
```

- [ ] **Step 3: 注册路由**

```typescript
// apps/api/src/app.ts
app.register(diagnosticRoutes);
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/diagnostics.ts apps/api/src/routes/task.ts apps/api/src/app.ts
git commit -m "feat: add diagnostics endpoints + SSE result_id persistence"
```

---

### Task 2.6: API 冒烟测试更新

**Files:**
- Modify: `scripts/smoke-test.sh`

- [ ] **Step 1: 扩展冒烟测试覆盖新端点**

```bash
# scripts/smoke-test.sh — 在现有 3 个测试后追加:

# 4. GET /api/strategies 返回新字段
echo "=== Test: GET /api/strategies returns new fields ==="
curl -s "$BASE/api/strategies" | grep -q "category" && echo "PASS: has category" || echo "FAIL: missing category"

# 5. PUT + GET config
echo "=== Test: PUT/GET /api/strategies/dual_ma/config ==="
curl -s -X PUT "$BASE/api/strategies/dual_ma/config" \
  -H "Content-Type: application/json" \
  -d '{"config":{"category":"non_factor","subcategory":"trend_cta","params":{}},"hash":"test"}' | grep -q '"saved":true' && echo "PASS: config saved" || echo "FAIL"

curl -s "$BASE/api/strategies/dual_ma/config" | grep -q "non_factor" && echo "PASS: config retrieved" || echo "FAIL"

# 6. Diagnostics 列表
echo "=== Test: GET /api/diagnostics ==="
curl -s "$BASE/api/diagnostics?strategy=dual_ma" | grep -q "\[\]" && echo "PASS: diagnostics empty" || echo "FAIL"
```

- [ ] **Step 2: 运行冒烟测试**

```bash
bash scripts/smoke-test.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/smoke-test.sh
git commit -m "test: extend smoke test to cover new strategy config and diagnostics endpoints"
```

---

## Phase 3: 前端

### Task 3.1: 前端类型同步 + API 层

**Files:**
- Modify: `apps/web/src/data/types.ts`
- Create: `apps/web/src/api/strategies-config.ts`
- Create: `apps/web/src/api/preview.ts`
- Create: `apps/web/src/api/diagnostics.ts`
- Modify: `apps/web/src/api/strategies.ts`

- [ ] **Step 1: types.ts 新增策略分类 + 预览类型**

```typescript
// apps/web/src/data/types.ts — 追加:

export type StrategyCategory = 'factor_based' | 'non_factor' | 'transitional';

export type StrategySubcategory =
  | 'linear_multi_factor' | 'index_enhancement' | 'ml_nonlinear_factor'
  | 'trend_cta' | 'arbitrage' | 'hft_microstructure' | 'macro_quant'
  | 'event_driven' | 'e2e_ai_timeseries'
  | 'event_sentiment_factor';

export interface UIConstraint {
  kind: 'require_when' | 'disable_when' | 'set_default_when' | 'range_when';
  targetField: string;
  targetValue: unknown;
  actionValue?: unknown;
}

export interface StrategyParamDef {
  name: string; label: string; type: string; default: unknown;
  min?: number; max?: number; options?: string[];
  chartRelevant: boolean;
  uiConstraints?: UIConstraint[];
}

// 扩展 StrategyRow
export interface StrategyRow {
  name: string;
  category: StrategyCategory;
  subcategory: StrategySubcategory | null;
  description: string;
  params: StrategyParamDef[];
  workflowReady: boolean;
  backtestable: boolean;
  version: string;
  summary?: { sharpe: string; return: string; drawdown: string };
}

// Preview 相关
export interface BarData { ts: number; o: number; h: number; l: number; c: number; v: number; }
export interface ChartOverlay {
  type: 'line' | 'marker'; label: string;
  data: { ts: number; value?: number; kind?: string }[];
  style?: { color: string; width: number };
}
export interface PreviewSignal {
  ts: number; side: 'buy' | 'sell'; price: number;
  reason: string; factor_snapshot: null;
}
export interface PreviewResponse {
  symbol: string; bars: BarData[]; overlays: ChartOverlay[];
  signals: PreviewSignal[];
  pagination: { has_more: boolean; next_cursor: number | null; total_count: number | null };
  fingerprint: string; engine_version: string;
}

// Diagnostics
export interface DiagnosticResult {
  resultId: string; strategyName: string;
  configSnapshot: unknown; data: unknown; createdAt: number;
}
```

- [ ] **Step 2: 创建 strategies-config API 客户端**

```typescript
// apps/web/src/api/strategies-config.ts

import { apiGet, apiPut } from './client';
import type { StrategyConfig } from './types';

export function fetchStrategyConfig(name: string): Promise<StrategyConfig | null> {
  return apiGet<StrategyConfig>(`/strategies/${name}/config`).catch(() => null);
}

export function saveStrategyConfig(name: string, config: StrategyConfig, hash: string) {
  return apiPut<{ saved: boolean; hash: string }>(`/strategies/${name}/config`, { config, hash });
}
```

- [ ] **Step 3: 创建 preview + diagnostics API 客户端**

```typescript
// apps/web/src/api/preview.ts
import { apiPost } from './client';
import type { PreviewResponse } from '../data/types';

export function fetchPreview(
  strategyName: string,
  body: { symbol: string; timeframe: string; cursor: number | null; limit?: number; preview_params: Record<string, unknown> }
): Promise<PreviewResponse> {
  return apiPost<PreviewResponse>(`/strategies/${strategyName}/preview`, body);
}

// apps/web/src/api/diagnostics.ts
import { apiGet } from './client';
import type { DiagnosticResult } from '../data/types';

export function fetchDiagnostic(resultId: string): Promise<DiagnosticResult> {
  return apiGet<DiagnosticResult>(`/diagnostics/${resultId}`);
}

export function fetchDiagnosticsByStrategy(strategyName: string): Promise<DiagnosticResult[]> {
  return apiGet<DiagnosticResult[]>(`/diagnostics?strategy=${strategyName}`);
}
```

- [ ] **Step 4: 更新 strategies.ts — 适配新 StrategyRow 类型**

```typescript
// apps/web/src/api/strategies.ts

// useStrategies hook — 移除硬编码 mode='traditional'，改用 API 返回的 category
// 过滤逻辑保留 backtestable !== false
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/data/types.ts apps/web/src/api/
git commit -m "feat: add frontend types and API clients for strategy config, preview, diagnostics"
```

---

### Task 3.2: Strategy 页面 — 总览 + 左右两栏配置+K线

**Files:**
- Create: `apps/web/src/components/strategy-page.tsx`
- Create: `apps/web/src/components/strategy-grid-new.tsx`
- Create: `apps/web/src/components/config-panel.tsx`
- Create: `apps/web/src/components/kline-chart.tsx`
- Create: `apps/web/src/styles/strategy-page.module.css`
- Create: `apps/web/src/styles/kline-chart.module.css`
- Modify: `apps/web/src/App.tsx` (导航)
- Modify: `apps/web/src/hooks/useResearchWorkflow.ts` (状态)

- [ ] **Step 1: 创建 StrategyPage 容器组件**

```tsx
// apps/web/src/components/strategy-page.tsx

import { useState, useMemo } from 'react';
import type { StrategyRow, StrategyCategory, StrategySubcategory } from '@/data/types';
import { StrategyGridNew } from './strategy-grid-new';
import { ConfigPanel } from './config-panel';
import { KlineChart } from './kline-chart';
import styles from '@/styles/strategy-page.module.css';

type ViewState = 'grid' | 'config';

export function StrategyPage({ strategies }: { strategies: StrategyRow[] }) {
  const [view, setView] = useState<ViewState>('grid');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyRow | null>(null);

  const handleSelectStrategy = (s: StrategyRow) => {
    setSelectedStrategy(s);
    setView('config');
  };

  const handleBackToGrid = () => {
    setView('grid');
    setSelectedStrategy(null);
  };

  if (view === 'grid') {
    return <StrategyGridNew strategies={strategies} onSelect={handleSelectStrategy} />;
  }

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={handleBackToGrid}>
        ← 策略总览
      </button>
      <h2 className={styles.title}>
        {selectedStrategy!.name}
        <span className={styles.badge}>{selectedStrategy!.category} / {selectedStrategy!.subcategory}</span>
      </h2>
      <div className={styles.layout}>
        <ConfigPanel strategy={selectedStrategy!} />
        <KlineChart strategy={selectedStrategy!} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 StrategyGridNew — 按 category 分组**

```tsx
// apps/web/src/components/strategy-grid-new.tsx

import type { StrategyRow, StrategyCategory } from '@/data/types';

const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  factor_based: '因子型',
  non_factor: '非因子型',
  transitional: '过渡形态',
};

export function StrategyGridNew({ strategies, onSelect }: {
  strategies: StrategyRow[];
  onSelect: (s: StrategyRow) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<StrategyCategory, StrategyRow[]>();
    for (const s of strategies) {
      if (!s.category) continue;
      const list = map.get(s.category) || [];
      list.push(s);
      map.set(s.category, list);
    }
    return map;
  }, [strategies]);

  return (
    <div>
      {(['factor_based', 'non_factor', 'transitional'] as StrategyCategory[]).map(cat => {
        const items = grouped.get(cat);
        if (!items?.length) return null;
        return (
          <section key={cat}>
            <h3>{CATEGORY_LABELS[cat]}</h3>
            <div className="grid">
              {items.map(s => (
                <div key={s.name} className="card" onClick={() => onSelect(s)}>
                  <h4>{s.name}</h4>
                  <p>{s.description}</p>
                  <span className="tag">{s.subcategory}</span>
                  {s.workflowReady && (
                    <button>进入工作区 →</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: 创建 ConfigPanel — 动态表单**

```tsx
// apps/web/src/components/config-panel.tsx

import { useState, useCallback } from 'react';
import type { StrategyRow, StrategySubcategory } from '@/data/types';
import { saveStrategyConfig } from '@/api/strategies-config';

export function ConfigPanel({ strategy }: { strategy: StrategyRow }) {
  const [params, setParams] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const p of strategy.params) {
      init[p.name] = p.default;
    }
    return init;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const config = {
      category: strategy.category,
      subcategory: strategy.subcategory!,
      params,
    };
    const hash = ''; // 前端按需生成
    await saveStrategyConfig(strategy.name, config, hash);
    setSaving(false);
  }, [strategy, params]);

  const renderParamInput = (p: StrategyParamDef) => {
    // 根据 p.type 渲染: number→slider/text, select→dropdown, bool→checkbox
    // 读取 p.ui_constraints 决定灰显/强制勾选
  };

  const renderDynamicSection = (sub: StrategySubcategory | null) => {
    switch (sub) {
      case 'linear_multi_factor':
        return (
          <>
            {/* 因子池配置: 多选下拉树 */}
            {/* 数据预处理: 极值缩尾 + 中性化 + 标准化 */}
          </>
        );
      case 'trend_cta':
        return (
          <>
            {/* 时序窗口参数: lookback_window slider + hold_period */}
            {/* 指标工具箱: MACD/RSI/布林带勾选卡片 */}
          </>
        );
      // ...其他子类型
    }
  };

  return (
    <div className="config-panel">
      <div className="tabs">
        {/* category tabs */}
      </div>
      <div className="sub-tabs">
        {/* subcategory tabs */}
      </div>
      <div className="params">
        {strategy.params.map(p => renderParamInput(p))}
      </div>
      {renderDynamicSection(strategy.subcategory)}
      <div className="actions">
        <button onClick={handleSave} disabled={saving}>保存配置</button>
        <button>预览回测</button>
        <button>提交任务</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 KlineChart — Canvas 渲染**

```tsx
// apps/web/src/components/kline-chart.tsx

import { useState, useEffect, useRef, useCallback } from 'react';
import type { StrategyRow, PreviewResponse, BarData, ChartOverlay } from '@/data/types';
import { fetchPreview } from '@/api/preview';

export function KlineChart({ strategy }: { strategy: StrategyRow }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [symbol, setSymbol] = useState('000001.SZ');
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);
  const [cursor, setCursor] = useState<number | null>(null);

  // 300ms debounce: 监听 strategy params 变化 → 重新请求 preview
  useEffect(() => {
    const timer = setTimeout(async () => {
      const chartParams: Record<string, unknown> = {};
      for (const p of strategy.params.filter(p => p.chartRelevant)) {
        chartParams[p.name] = p.default; // 实际应从 ConfigPanel 状态读取
      }
      const result = await fetchPreview(strategy.name, {
        symbol, timeframe: '1d', cursor, limit: 500, preview_params: chartParams,
      });
      setPreview(result);

      // 检查 fingerprint 变化
      if (fingerprint && result.fingerprint !== fingerprint) {
        // Toast: "预览信号算法已更新，请刷新页面加载新版本"
      }
      setFingerprint(result.fingerprint);
    }, 300);
    return () => clearTimeout(timer);
  }, [strategy.name, symbol]);

  // Canvas 绘制逻辑（蜡烛图 + 叠加层 + 信号标注）
  useEffect(() => {
    if (!preview || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d')!;
    // 绘制: bars → overlays → signals
    drawChart(ctx, preview.bars, preview.overlays, preview.signals);
  }, [preview]);

  return (
    <div className="kline-panel">
      <div className="symbol-picker">
        <input type="text" value={symbol} onChange={e => setSymbol(e.target.value)}
               placeholder="搜索标的..." />
      </div>
      <div style={{ position: 'relative' }}>
        <canvas ref={canvasRef} width={800} height={500} />
        <span className="preview-badge" title="信号由轻量引擎实时生成，用于参数灵敏度调节，精确绩效请以回测报告为准">
          [预览引擎]
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 更新 App.tsx 导航**

```tsx
// apps/web/src/App.tsx — 在 PageId 联合类型中追加:
type PageId = ... | 'strategy';

// 侧边栏追加导航项:
<NavItem page="strategy" label="Strategy" />

// 页面条件渲染:
{activePage === 'strategy' && <StrategyPage strategies={availableStrategies} />}
```

- [ ] **Step 6: 前端测试 + build**

```bash
cd apps/web && npx tsc --noEmit && npm test && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/strategy-page.tsx apps/web/src/components/strategy-grid-new.tsx apps/web/src/components/config-panel.tsx apps/web/src/components/kline-chart.tsx apps/web/src/styles/strategy-page.module.css apps/web/src/styles/kline-chart.module.css apps/web/src/App.tsx apps/web/src/hooks/useResearchWorkflow.ts
git commit -m "feat: add Strategy page with grid overview + config panel + K-line chart with preview engine"
```

---

### Task 3.3: Workspace 页面 — 两步步骤条

**Files:**
- Create: `apps/web/src/components/workspace-page.tsx`
- Create: `apps/web/src/components/workspace-step1.tsx`
- Create: `apps/web/src/components/workspace-step2.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: 创建 WorkspacePage**

```tsx
// apps/web/src/components/workspace-page.tsx

import { useState, useEffect } from 'react';
import type { StrategyRow, DiagnosticResult } from '@/data/types';
import { WorkspaceStep1 } from './workspace-step1';
import { WorkspaceStep2 } from './workspace-step2';
import { fetchDiagnostic } from '@/api/diagnostics';

type Step = 1 | 2;

export function WorkspacePage({ strategy }: { strategy: StrategyRow }) {
  const [step, setStep] = useState<Step>(1);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);

  // 页面加载时检查 URL searchParams 恢复诊断结果
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const diagId = params.get('diagnosticId');
    if (diagId) {
      fetchDiagnostic(diagId).then(r => {
        if (r) setDiagnosticResult(r);
      });
    }
  }, []);

  const handleStep1Complete = (result: DiagnosticResult) => {
    setDiagnosticResult(result);
    // 更新 URL searchParams
    const url = new URL(window.location.href);
    url.searchParams.set('diagnosticId', result.resultId);
    window.history.replaceState({}, '', url.toString());
    setStep(2);
  };

  return (
    <div className="workspace">
      <div className="step-indicator">
        <div className={`step ${step === 1 ? 'active' : 'done'}`}>
          <span className="circle">1</span>
          <span>策略诊断与研究</span>
        </div>
        <div className="connector" />
        <div className={`step ${step === 2 ? 'active' : ''}`}>
          <span className="circle">2</span>
          <span>回测与绩效</span>
        </div>
      </div>
      <div className="step-content">
        {step === 1 && (
          <WorkspaceStep1 strategy={strategy} onComplete={handleStep1Complete} />
        )}
        {step === 2 && (
          <WorkspaceStep2 strategy={strategy} diagnosticResult={diagnosticResult} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 创建 WorkspaceStep1 — 动态诊断内容**

```tsx
// apps/web/src/components/workspace-step1.tsx

import { useState } from 'react';
import type { StrategyRow, StrategySubcategory } from '@/data/types';

export function WorkspaceStep1({ strategy, onComplete }: {
  strategy: StrategyRow;
  onComplete: (result: any) => void;
}) {
  const [running, setRunning] = useState(false);

  const handleStartDiagnostics = async () => {
    setRunning(true);
    // POST /api/tasks { type: "diagnostics", payload: { strategy, configSnapshot } }
    // 通过 SSE 接收进度
    // complete 后调用 onComplete(diagnosticResult)
  };

  const renderDiagnosticContent = () => {
    const sub = strategy.subcategory;
    switch (sub) {
      case 'linear_multi_factor':
      case 'index_enhancement':
      case 'ml_nonlinear_factor':
        return (
          <div className="factor-diagnostics">
            <h4>因子 IC/IR 分析</h4>
            <div className="chart-placeholder">{/* IC 热力图 */}</div>
            <h4>分层收益柱状图</h4>
            <div className="chart-placeholder">{/* 分组收益 */}</div>
            <h4>因子相关性热力图</h4>
            <div className="chart-placeholder">{/* 相关性矩阵 */}</div>
            <button onClick={handleStartDiagnostics} disabled={running}>
              {running ? '计算中...' : '确认因子有效 → 进入回测'}
            </button>
          </div>
        );
      case 'trend_cta':
      case 'arbitrage':
      case 'hft_microstructure':
        return (
          <div className="nonfactor-diagnostics">
            <h4>参数敏感性热力图</h4>
            <div className="chart-placeholder">{/* 参数热力图 */}</div>
            <h4>信号数量/质量分布</h4>
            <div className="chart-placeholder">{/* 信号直方图 */}</div>
            <h4>滑点/手续费压力测试</h4>
            <div className="chart-placeholder">{/* 收益衰减曲线 */}</div>
            <button onClick={handleStartDiagnostics} disabled={running}>
              {running ? '计算中...' : '确认参数鲁棒 → 进入回测'}
            </button>
          </div>
        );
      // ...其他子类型
      default:
        return <p>该策略类型的诊断模块尚未就绪</p>;
    }
  };

  return <div className="step1-content">{renderDiagnosticContent()}</div>;
}
```

- [ ] **Step 3: 创建 WorkspaceStep2 — 回测流**

```tsx
// apps/web/src/components/workspace-step2.tsx

// 回测配置摘要(只读) → 提交回测 → SSE 进度条 → 绩效结果
// 复用现有 useTaskStream hook
```

- [ ] **Step 4: 更新 App.tsx 路由**

```tsx
// apps/web/src/App.tsx
{activePage === 'workspace' && <WorkspacePage strategy={selectedStrategy!} />}
```

- [ ] **Step 5: 前端测试 + build**

```bash
cd apps/web && npx tsc --noEmit && npm test && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/workspace-page.tsx apps/web/src/components/workspace-step1.tsx apps/web/src/components/workspace-step2.tsx apps/web/src/App.tsx
git commit -m "feat: add Workspace page with 2-step flow and dynamic diagnostics content"
```

---

### Task 3.4: 端到端接线 + 清理

**Files:**
- Modify: `apps/web/src/hooks/useResearchWorkflow.ts` (删除 ResearchModeId 引用)
- Modify: `apps/web/src/components/strategy-grid.tsx` (替换为新 StrategyGridNew)
- Modify: `apps/web/src/data/en.ts`, `zh.ts` (更新策略分类文案)
- Modify: `apps/web/tests/setup.ts` (扩展 mock)

- [ ] **Step 1: 清理 useResearchWorkflow 中的 ResearchModeId**

```typescript
// apps/web/src/hooks/useResearchWorkflow.ts

// 删除 activeMode: ResearchModeId = 'traditional'
// 替换为: activeCategory: StrategyCategory | null = null

// handleSelectStrategy 中设置 activeCategory = strategy.category
```

- [ ] **Step 2: 更新前端 mock**

```typescript
// apps/web/tests/setup.ts — 追加新端点的 mock:
// GET /api/strategies/:name/config → null
// PUT /api/strategies/:name/config → { saved: true }
// POST /api/strategies/:name/preview → { bars: [], overlays: [], signals: [], ... }
// GET /api/diagnostics/:id → null
// GET /api/diagnostics?strategy= → []
```

- [ ] **Step 3: 更新国际化文案**

```typescript
// apps/web/src/data/zh.ts — 追加策略分类相关文案:
factor_based: '因子型',
non_factor: '非因子型',
transitional: '过渡形态',
// 子类型同理
```

- [ ] **Step 4: 全量验证**

```bash
# JS 侧
pnpm lint && pnpm test && pnpm build

# Python 侧
for pkg in strategy-runtime backtest-engine strategies data-client factor-lab ai-engine obsidian-sync; do
  (cd packages/$pkg && python -m pytest -v)
done

# API 冒烟测试
bash scripts/smoke-test.sh
```

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: complete strategy classification refactor — types, API, frontend config+workspace, e2e wiring"
```

---

## 验证清单

- [ ] `GET /api/strategies` 返回含 category/subcategory/workflowReady 的策略列表
- [ ] `PUT /api/strategies/:name/config` 保存全量拍平配置
- [ ] `GET /api/strategies/:name/config` 恢复已保存配置
- [ ] `POST /api/strategies/:name/preview` 返回 K线+叠加层+信号 (< 500ms)
- [ ] preview 分页 cursor 正常工作（加载更多）
- [ ] `POST /api/tasks` 只接受 configSnapshot，无顶层 params
- [ ] `GET /api/diagnostics/:resultId` 恢复诊断结果
- [ ] SSE complete 事件下发 result_id
- [ ] 前端 Strategy 页面：总览卡片(按 category 分组) → 选中进入左右两栏
- [ ] 前端 ConfigPanel：动态表单按 subcategory 渲染
- [ ] 前端 KlineChart：Canvas 渲染 + Preview 引擎 + 免责标签
- [ ] 前端 Workspace：两步步骤条 → step1 按 subcategory 动态内容
- [ ] F5 刷新 Workspace 页面 → 从 URL searchParams 恢复诊断结果
- [ ] 存量 Python 策略向后兼容（新字段有默认值）
- [ ] 所有现有测试通过（pytest + vitest）
- [ ] 冒烟测试通过
