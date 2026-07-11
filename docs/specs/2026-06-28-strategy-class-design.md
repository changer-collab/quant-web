# 策略分类体系重构 & 策略配置页面设计

> 状态：产品目标基准 | 日期：2026-06-28 | 审计基础：pipeline-audit-2026-06-28
>
> 历史实施计划（已归档）：[2026-06-30-contract-realign.md](../plans/archive/2026-06-30-contract-realign.md)。本文定义分类、配置、Preview、Task、Diagnostics 的目标形态，核心已落地。

## 一、问题陈述

当前策略系统存在三个结构性缺陷：

1. **分类体系混乱**：`ResearchMode`（traditional/hft/ai）、`StrategyKind`（combined/select/timing/position/composite）、`strategyCategory` 三个正交概念互不关联，且三层（Python/API/前端）枚举值不一致。
2. **因子型与非因子型未区分**：两类策略的研究路径完全不同（因子型要因子评估→选股回测，非因子型直接策略逻辑→回测），当前 Workspace 未体现差异。
3. **前端 17 个策略中 12 个是 mock 占位**，缺少统一配置入口和参数探索的可视化反馈。

## 二、策略分类体系

### 一级导航：StrategyCategory

```
StrategyCategory (侧边栏一级导航)
├── 因子型 FACTOR_BASED
│   ├── 线性多因子选股 LINEAR_MULTI_FACTOR
│   ├── 指数增强 INDEX_ENHANCEMENT
│   └── ML 非线性因子 ML_NONLINEAR_FACTOR
├── 非因子型 NON_FACTOR
│   ├── 时序趋势 TREND_CTA
│   ├── 套利 ARBITRAGE
│   ├── 高频微观结构 HFT_MICROSTRUCTURE
│   ├── 宏观量化 MACRO_QUANT
│   ├── 事件驱动 EVENT_DRIVEN
│   └── 端到端 AI 时序 E2E_AI_TIMESERIES
└── 过渡形态 TRANSITIONAL
    └── 事件/舆情标准化因子 EVENT_SENTIMENT_FACTOR
```

### 区分标准

|          | 因子型                      | 非因子型                     | 过渡形态            |
| -------- | --------------------------- | ---------------------------- | ------------------- |
| 核心逻辑 | 跨截面打分排序              | 时序价差/盘口/宏观/事件      | 事件→标准化因子映射 |
| 研究单元 | 因子（先验证因子质量）      | 策略本身                     | 数据源→因子         |
| 回测前   | 因子 IC/分层回测/相关性矩阵 | 参数敏感性/信号质量/滑点压力 | 情感衰减→映射验证   |
| 打分框架 | 统一因子库+分层回测         | 无统一因子打分               | 挂载到现有因子库    |

## 三、后端类型系统 (Python)

### 3.1 分类枚举

```python
class StrategyCategory(str, Enum):
    FACTOR_BASED = "factor_based"
    NON_FACTOR = "non_factor"
    TRANSITIONAL = "transitional"

class StrategySubcategory(str, Enum):
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

### 3.2 策略元数据（扩展 StrategyMeta）

```python
@dataclass(frozen=True)
class StrategyMeta:
    name: str
    category: StrategyCategory
    subcategory: StrategySubcategory
    description: str
    params: list[StrategyParamDef]
    version: str

    @property
    def factor_based(self) -> bool:
        return self.category == StrategyCategory.FACTOR_BASED

    # 仅因子型使用
    required_factors: list[str] | None = None
    factor_pool: str | None = None
```

### 3.3 参数定义扩展（新增 ui_constraints）

```python
@dataclass(frozen=True)
class StrategyParamDef:
    name: str
    type: str                      # "int" | "float" | "select" | "bool" | "slider"
    default: Any
    range: tuple[float, float] | None = None
    options: list[str] | None = None
    chart_relevant: bool = False   # 🆕 此参数变动是否需要重新请求 preview
    ui_constraints: list[UIConstraint] | None = None  # 🆕 前端联动校验

@dataclass
class UIConstraint:
    kind: str  # "require_when" | "disable_when" | "set_default_when" | "range_when"
    target_field: str
    target_value: Any
    action_value: Any | None = None
```

### 3.4 策略配置（全量拍平，唯一真相源）

```python
@dataclass
class FactorBasedConfig:
    factor_pool: list[str]
    winsorize: tuple[float, float]      # (±3σ / ±5σ)
    neutralization: list[str]           # ["industry", "market_cap"]
    standardization: str                # "zscore" / "quantile" / "rank"
    interaction_terms: bool = False
    max_interaction_order: int = 2

@dataclass
class NonFactorConfig:
    lookback_window: int
    hold_period: int
    indicators: list[str]
    indicator_params: dict
    dynamic_params: dict               # 子类型特有参数

@dataclass
class TransitionalConfig:
    data_source: str
    sentiment_decay_half_life: float
    target_factor_pool: str
```

## 四、前端类型系统 (TypeScript)

### 4.1 分类类型

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

### 4.2 策略行（替换当前 StrategyRow）

```typescript
export interface StrategyRow {
  name: string;
  category: StrategyCategory;
  subcategory: StrategySubcategory;
  description: string;
  version: string;
  params: StrategyParamDef[];
  workflowReady: boolean; // 后端判断：策略已注册 + 有可用标的
  backtestable: boolean;
  // 显示摘要（从最近一次回测结果提取）
  summary?: {
    sharpe: string;
    return: string;
    drawdown: string;
  };
}

export interface StrategyParamDef {
  name: string;
  type: 'int' | 'float' | 'select' | 'bool' | 'slider';
  default: unknown;
  range?: [number, number];
  options?: string[];
  chartRelevant: boolean;
  uiConstraints?: UIConstraint[];
}

export interface UIConstraint {
  kind: 'require_when' | 'disable_when' | 'set_default_when' | 'range_when';
  targetField: string;
  targetValue: unknown;
  actionValue?: unknown;
}
```

### 4.3 删除的类型

删除 `ResearchModeId`（`'traditional' | 'hft' | 'ai'`）。原有按 research mode 分组逻辑全部替换为按 `category` + `subcategory` 分组。

## 五、前端页面设计

### 5.1 侧边栏导航

```
Dashboard
Factor Lab
Strategy    ← 新页面入口
Workspace
Backtest History
Data Management
```

### 5.2 Strategy 页面（两态）

**默认态：策略总览**

策略卡片按 category 三区排列（Factor/Non-Factor/Transitional），每区内按 subcategory 折叠分组。卡片显示：名称、描述、参数数量、最近回测摘要（如有）、"进入工作区"按钮。

**配置态：选中策略 → 左右两栏**

```
┌──────────────────────────────────────────────────────────┐
│ ← 策略总览           策略名称 + 分类标签                    │
├────────────────────────┬─────────────────────────────────┤
│  【左侧】配置面板       │  【右侧】可视化面板               │
│                        │                                 │
│  一级分类 Tab          │  ① 品种/合约选择器               │
│  (因子型/非因子型/过渡) │                                 │
│                        │  ② K线图主渲染区 (Canvas)        │
│  二级子类型 Tab         │    ├─ 主图: 蜡烛图 + MA 叠加     │
│                        │    ├─ 副图1: 成交量柱状图         │
│  核心参数区 (动态表单)   │    └─ 副图2: 策略专属指标        │
│                        │      [因子型] 因子IC序列折线      │
│  ├─ [因子型]            │      [趋势] RSI/MACD 金叉标记    │
│  │  因子池配置          │      [高频] 盘口买卖价差         │
│  │  数据预处理流水线     │      [过渡] 情感得分走势         │
│  │  高阶衍生开关(ML)    │                                 │
│  │                     │  ③ 时间轴+窗口拖拽               │
│  ├─ [非因子型]          │                                 │
│  │  时序窗口参数         │  ④ 信号/交易点位标注层           │
│  │  指标/信号工具箱      │     (买卖箭头 + hover tooltip)   │
│  │  动态参数区          │                                 │
│  │                     │                                 │
│  └─ [过渡形态]          │                                 │
│     数据源绑定          │                                 │
│     情感衰减配置         │                                 │
│     映射目标因子         │                                 │
│                        │                                 │
│  [保存配置] [预览回测]   │  [预览引擎] ← 淡灰色标签         │
│  [提交任务]             │  悬停: "信号由轻量引擎实时生成…"  │
├────────────────────────┴─────────────────────────────────┤
│ 🟢 数据区间: 2020-01-01 ~ 2025-06-28  500/1250 bars      │
│ [同步到训练集日期框]                                      │
└──────────────────────────────────────────────────────────┘
```

### 5.3 Workspace 页面（水平两步步骤条）

```
┌────────────────────────────────────────────────────────────┐
│ ← 返回策略配置    策略名称 | 分类标签                        │
│                                                            │
│  ●━━━━━━━━━━━○                                            │
│  步骤1              步骤2                                  │
│  策略诊断与研究      回测与绩效                              │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  [内容根据 subcategory 动态渲染]                             │
│                                                            │
│  ┌─ 因子型 ──────────────────────────────────────────────┐ │
│  │  因子IC/IR 分析 | 分层收益柱状图 | 因子相关性热力图       │ │
│  │  [确认因子有效 → 进入回测]                              │ │
│  ├─ 趋势/套利/高频 ──────────────────────────────────────┤ │
│  │  参数敏感性热力图 | 信号数量/质量分布 | 滑点压力测试曲线   │ │
│  │  [确认参数鲁棒 → 进入回测]                              │ │
│  ├─ 宏观量化 ────────────────────────────────────────────┤ │
│  │  宏观变量与资产收益互相关图 | 经济周期阶段标注            │ │
│  │  [确认宏观锚定 → 进入回测]                              │ │
│  ├─ 事件驱动 ────────────────────────────────────────────┤ │
│  │  事件前后累计异常收益(CAR)图 | 事件样本统计              │ │
│  │  [确认事件效应 → 进入回测]                              │ │
│  └─ E2E AI ──────────────────────────────────────────────┘ │
│     特征重要性排名(SHAP) | 训练/验证 Loss 曲线              │
│     [确认模型稳定 → 进入回测]                               │
│                                                            │
└────────────────────────────────────────────────────────────┘

步骤2 全类型统一：回测配置摘要(只读) → 进度条 → 绩效报告
```

## 六、API 契约

### 6.1 端点全景

| 端点                            | 方法 | 用途                                              | 变更类型 |
| ------------------------------- | ---- | ------------------------------------------------- | -------- |
| `/api/strategies`               | GET  | 策略列表（含 category/subcategory/workflowReady） | 扩展     |
| `/api/strategies/:name`         | GET  | 策略详情（含 params 含 uiConstraints）            | 扩展     |
| `/api/strategies/:name/config`  | GET  | 读取已保存配置                                    | 🆕       |
| `/api/strategies/:name/config`  | PUT  | 保存配置（全量拍平）                              | 🆕       |
| `/api/strategies/:name/preview` | POST | K线图信号预览（cursor 分页）                      | 🆕       |
| `/api/tasks`                    | POST | 提交任务（configSnapshot 为唯一真相源）           | 修改     |
| `/api/tasks/:id`                | GET  | 查询任务（扩展 result_payload）                   | 扩展     |
| `/api/tasks/:id/stream`         | GET  | SSE 事件流（扩展 result_id）                      | 扩展     |
| `/api/diagnostics/:resultId`    | GET  | 查询持久化诊断结果                                | 🆕       |
| `/api/diagnostics`              | GET  | 列出策略的历史诊断结果                            | 🆕       |

### 6.2 端点详解

#### GET /api/strategies

```typescript
// Response 200
[
  {
    name: 'linear_multi_factor_v1',
    category: 'factor_based',
    subcategory: 'linear_multi_factor',
    description: '多因子选股策略——估值+动量+质量',
    version: '1.0.0',
    params: [
      /* StrategyParamDef[] with uiConstraints */
    ],
    workflowReady: true, // 后端判断
    backtestable: true,
    summary: { sharpe: '1.42', return: '+32.5%', drawdown: '-15.2%' },
  },
];
```

#### PUT /api/strategies/:name/config

```typescript
// Request body — 全量拍平
{
  category: "non_factor",
  subcategory: "trend_cta",
  config: {
    lookback_window: 20,
    hold_period: 5,
    indicators: ["macd", "rsi"],
    indicator_params: { macd_fast: 12, macd_slow: 26, rsi_period: 14 }
  },
  hash: "a1b2c3d4"
}

// Response 201
{ saved: true, hash: "a1b2c3d4" }
```

#### POST /api/strategies/:name/preview

```typescript
// Request body
{
  symbol: "000001.SZ",
  timeframe: "1d",
  cursor: 1704067200 | null,    // 时间戳游标，首次 null
  limit: 500,                   // 默认 500
  preview_params: {             // 🆕 轻量参数子集（仅 chart_relevant 字段）
    lookback_window: 20,
    indicators: ["macd", "rsi"],
    macd_fast: 12,
    macd_slow: 26,
    rsi_period: 14
  }
}

// Response 200 — 同步
{
  symbol: "000001.SZ",
  bars: [{ ts, o, h, l, c, v }],
  overlays: [
    { type: "line", label: "MA20", data: [{ ts, value }], style: { color, width } },
    { type: "marker", label: "MACD Cross", data: [{ ts, kind: "golden_cross"|"death_cross" }] }
  ],
  signals: [
    { ts, side: "buy"|"sell", price, reason, factor_snapshot: null }
  ],
  pagination: {
    has_more: true,
    next_cursor: 1672531200,
    total_count: 1250
  },
  fingerprint: "sha256:a3f2b...",     // 🆕 hash(params + 最后10根K线收盘价)
  engine_version: "1.0.0"
}
```

#### POST /api/tasks（修改）

```typescript
// Request body — configSnapshot 为唯一真相源，不再有顶层 params
{
  type: "backtest",
  payload: {
    strategy: "linear_multi_factor_v1",
    symbol: "000001.SZ",
    timeframe: "1d",
    initialCash: 1000000,
    slippage: 0.0001,
    startTs: 1672531200,
    endTs: 1717200000,
    configSnapshot: {            // 全量，唯一真相源
      category: "factor_based",
      subcategory: "linear_multi_factor",
      params: {
        factor_pool: ["value_pe", "momentum_20d", "quality_roe"],
        winsorize: [-3, 3],
        neutralization: ["industry"],
        standardization: "zscore"
      }
    }
  }
}
// Response 202 { id, status: "pending" }
```

#### GET /api/tasks/:id/stream（SSE 扩展）

```typescript
// SSE complete event — 新增 result_id
event: result
data: {
  "type": "result",
  "taskId": "task_abc123",
  "resultId": "diag_a1b2c3d4",   // 🆕 持久化结果 ID
  "resultType": "diagnostics",    // 🆕 "diagnostics" | "backtest"
  "data": { /* 诊断或回测结果 */ }
}
```

#### GET /api/diagnostics/:resultId

```typescript
// Response 200 — 页面刷新后恢复诊断结果
{
  resultId: "diag_a1b2c3d4",
  strategy: "linear_multi_factor_v1",
  configSnapshot: { /* 全量 */ },
  data: { /* IC 热力图 / 参数敏感性矩阵 */ },
  createdAt: 1717200000
}
```

## 七、K线图 Preview 引擎（软边界）

### 职责边界

```
API Server（Node.js TypeScript）              Worker（Node.js + Python）
├── 指标叠加计算 (MA/EMA/MACD/RSI)            ├── 回测执行
├── 虚拟信号标注 (金叉死叉/超买超卖)           ├── 因子评估
├── Config CRUD                               ├── AI 训练
└── Diagnostics 查询                           ├── 诊断计算（IC热力图等）
                                               └── 报告生成
```

Preview 是纯 TypeScript 轻量计算，不依赖 Python。指标算法与 Python 策略实现可能产生微小偏差。

### 前端免责

K线图 MACD/RSI 图层左上角显示淡灰色 `[预览引擎]` 标签。鼠标悬浮 Tooltip：

> "信号由轻量引擎实时生成，用于参数灵敏度调节，精确绩效请以回测报告为准"

### 算法版本指纹

POST /preview 响应体含 `fingerprint` 字段（hash(params + 最后10根K线收盘价)）。前端拿到后存入 localStorage。下次同参数请求返回不同 fingerprint → 右下角 Toast：

> "预览信号算法已更新，请刷新页面加载新版本"

此机制不阻塞用户操作，纯信息提示。

## 八、诊断结果持久化

诊断计算耗时 1~2 分钟。防止 F5 刷新丢失结果：

1. SSE complete 事件下发 `result_id`
2. 前端写入 URL searchParams：`?diagnosticId=diag_a1b2c3d4`
3. 页面加载时检查 searchParams → `GET /api/diagnostics/:resultId` → 恢复
4. 诊断结果 7 天自动清理 (`purgeOlderThan(7)`)
5. `GET /api/diagnostics?strategy=linear_multi_factor_v1` 列出历史

## 九、后端三层架构

### 依赖拓扑

```
Route → Service (依赖接口) → Repository (唯一认识 SQLite 的地方)
```

```
index.ts (Composition Root — 唯一实例化具体类的地方)
  │
  ├── Repository 实现
  │   ├── SqliteConfigRepo : IConfigRepo            🆕
  │   ├── SqliteConfigHistoryRepo : IConfigHistoryRepo  🆕
  │   ├── SqliteDiagnosticRepo : IDiagnosticRepo    🆕
  │   ├── SqliteReportRepo : IReportRepo            (已有类，补接口)
  │   └── SqliteEvalRepo : IEvalRepo                (已有类，补接口)
  │
  ├── Service 实现
  │   ├── StrategyConfigService(configRepo)          🆕
  │   ├── DiagnosticService(diagRepo, configRepo)    🆕
  │   └── PreviewService()                           🆕 纯 TS 计算，无 DB
  │
  └── 注入到 Fastify
      app.decorate('configService', configService)
      app.decorate('diagnosticService', diagnosticService)
      app.decorate('previewService', previewService)
```

### 接口定义

```typescript
// apps/api/src/repositories/interfaces.ts

interface IConfigRepo {
  get(strategyName: string): Promise<StrategyConfig | null>;
  save(strategyName: string, config: StrategyConfig, hash: string): Promise<void>;
}

interface IConfigHistoryRepo {
  append(strategyName: string, config: StrategyConfig, hash: string): Promise<void>;
  list(strategyName: string, limit?: number): Promise<ConfigHistoryEntry[]>;
}

interface IDiagnosticRepo {
  save(result: DiagnosticResult): Promise<void>;
  getById(resultId: string): Promise<DiagnosticResult | null>;
  listByStrategy(strategyName: string, limit?: number): Promise<DiagnosticResult[]>;
  purgeOlderThan(days: number): Promise<number>;
}

interface IReportRepo {
  save(report: BacktestReportFull): Promise<void>;
  getById(id: string): Promise<BacktestReportFull | null>;
  list(filter: ReportFilter): Promise<BacktestReportFull[]>;
  delete(id: string): Promise<void>;
  count(filter: ReportCountFilter): Promise<number>;
}
```

### 历史表透明写入

`SqliteConfigRepo.save()` 内部持有 `IConfigHistoryRepo` 引用。每次保存后透明调用 `history.append()`。Service 层不感知 `IConfigHistoryRepo` 的存在。

```typescript
class SqliteConfigRepo implements IConfigRepo {
  constructor(
    private db: DrizzleDB,
    private history: IConfigHistoryRepo
  ) {}

  async save(name: string, config: StrategyConfig, hash: string): Promise<void> {
    await this.db.insert(strategyConfigs).values({ ... })
      .onConflictDoUpdate({ ... });
    await this.history.append(name, config, hash);  // 透明写入
  }
}
```

### SQLite WAL 模式

```typescript
// apps/api/src/storage/connection.ts
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');
```

`data-center` 的 SQLite 已启用 WAL（`connection.ts:50`）。

## 十、数据库新增表

### strategy_configs

```sql
CREATE TABLE strategy_configs (
  strategy_name TEXT PRIMARY KEY,
  config_json  TEXT NOT NULL,    -- 全量拍平 JSON
  hash         TEXT NOT NULL,
  updated_at   INTEGER NOT NULL
);
```

### config_history

```sql
CREATE TABLE config_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  strategy_name TEXT NOT NULL,
  config_json   TEXT NOT NULL,
  hash          TEXT NOT NULL,
  created_at    INTEGER NOT NULL,
  INDEX idx_config_history_strategy (strategy_name, created_at DESC)
);
```

### diagnostic_results

```sql
CREATE TABLE diagnostic_results (
  result_id        TEXT PRIMARY KEY,
  strategy_name    TEXT NOT NULL,
  config_snapshot  TEXT NOT NULL,
  data_json        TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  INDEX idx_diag_strategy_created (strategy_name, created_at DESC)
);
```

## 十一、数据流总览

### 参数调节实时反馈

```
左侧表单参数变化
    │
    ├── 300ms debounce
    ├── 提取 chart_relevant: true 的字段 → preview_params
    ├── POST /api/strategies/:name/preview
    │       ↓
    │   PreviewService (TypeScript, 进程内)
    │       ├── 查询 bars (从 SQLite)
    │       ├── 计算指标叠加层
    │       ├── 标注虚拟信号
    │       └── 返回 { bars, overlays, signals, fingerprint }
    │
    └── 前端 Canvas 本地重绘
```

### 回测任务提交

```
[提交任务] 按钮
    │
    ├── POST /api/tasks  { configSnapshot: 全量拍平 }
    │       ↓
    │   TaskService.submit()
    │       ↓
    │   Worker 轮询 pending → claim
    │       ├── Python subprocess 执行回测
    │       ├── SSE 实时推送进度
    │       └── complete: auto-generate report
    │
    └── 前端 SSE 接收 → 跳转报告页
```

### 诊断数据恢复

```
页面 F5 刷新
    │
    ├── 检查 URL searchParams: ?diagnosticId=xxx
    ├── GET /api/diagnostics/xxx → 200 恢复
    │   或 404（已过期）→ 重新提交诊断任务
    └── 渲染到步骤1面板
```

## 十二、明确不做

- **不做**策略的增量差异（diff/patch）配置更新——全量拍平保证幂等性
- **不做**Python 端 K线预览——PreviewService 纯 TypeScript，与回测 Python 引擎解耦
- **不做**实时 WebSocket —— 当前 SSE 足够覆盖任务进度和诊断推送
- **不做**Strategy 页面的独立"策略库"导航项——策略广场是 Strategy 页面的默认态（方案 A）
- **不删除**现有回测引擎、matcher、market_rules、report pipeline —— 本次重构只影响策略分类体系和配置页面
- **不做**数据库迁移此阶段——PostgreSQL/ClickHouse 支持通过对现有接口实现新 Repository 类达成

## 十三、与现有系统的兼容性

- 现有 `StrategyMeta.kind` 保留，`category`/`subcategory` 为新增字段
- 现有回测引擎 `runner.py` 不做任何修改——它通过 `configSnapshot` 获取策略参数
- 现有 `POST /api/tasks` 删除顶层 `params` 字段，向后不兼容——仅需更新 Worker 端参数读取路径
- 前端 `ResearchModeId`（`'traditional' | 'hft' | 'ai'`）废弃，替换为 `StrategyCategory` + `StrategySubcategory`
- `data-center` 的 `RepositorySet` 接口体系不变，API 侧新增接口独立定义
