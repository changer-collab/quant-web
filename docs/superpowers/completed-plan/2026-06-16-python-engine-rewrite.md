# Python 引擎重塑开发计划

> **执行方式:** 使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 逐任务执行。步骤用 `- [ ]` 跟踪。

**目标:** 将计算密集型引擎从 TypeScript 重写为 Python，利用 Python 量化生态。IO 层保持 TypeScript 不变。

---

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│  TypeScript 层（保留）                                    │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐      │
│  │ web  │  │ api  │  │worker│  │data- │  │data- │      │
│  │      │  │      │  │      │  │center│  │collec│      │
│  └──────┘  └──────┘  └──┬───┘  └──┬───┘  └──────┘      │
│                         │子进程    │SQLite               │
└─────────────────────────┼─────────┼─────────────────────┘
                          │         │
┌─────────────────────────┼─────────┼─────────────────────┐
│  Python 层（新建）       │         │                      │
│                    ┌────┴───┐ ┌───┴────┐                 │
│                    │ CLI入口 │ │data-   │                 │
│                    │(JSON)  │ │client  │                 │
│                    └───┬────┘ └───┬────┘                 │
│            ┌───────────┼──────────┘                      │
│       ┌────┴────┐ ┌────┴─────┐ ┌────────┐ ┌──────────┐  │
│       │strategy │ │backtest  │ │factor  │ │ai-engine │  │
│       │runtime  │ │engine    │ │lab     │ │          │  │
│       └────┬────┘ └────┬─────┘ └───┬────┘ └────┬─────┘  │
│            │            │           │           │         │
│       ┌────┴────────────┴───────────┴───────────┘         │
│       │ strategies-py (策略库)                            │
│       └──────────────────────────────────────────────────┘
└──────────────────────────────────────────────────────────┘
```

**通信方式:**
- Worker(TS) → Python CLI: 子进程，stdin 传入 JSON 配置，stdout 返回 JSON 结果
- Python → 数据: thin data client 直接读 data-center 的 SQLite (`data/quant.db`)

---

## 技术栈决策

| 模块 | 语言 | 理由 |
|------|------|------|
| data-center | **TypeScript 保留** | IO 密集层，Python 无优势；125K+ 字符重写成本高；独立部署需稳定 |
| data-collector | **TypeScript 保留** | 数据管道，IO 密集；与 data-center 同栈 |
| api | **TypeScript 保留** | HTTP 入口，IO 密集 |
| worker | **TypeScript 保留** | 任务编排，通过子进程调用 Python |
| web | **TypeScript 保留** | 前端界面 |
| strategy-runtime-py | **Python 新建** | 策略接口，Python 量化开发者友好 |
| backtest-engine-py | **Python 新建** | 计算密集，numpy/pandas 加速 |
| factor-lab-py | **Python 新建** | 因子计算依赖 pandas/numpy |
| ai-engine-py | **Python 新建** | ML 生态（scikit-learn, PyTorch） |
| strategies-py | **Python 新建** | 策略实现，Python 开发者友好 |
| data-client-py | **Python 新建** | 轻量 SQLite 读取客户端 |

### 数据中心为何不换 Python

1. **IO 密集型** — 数据中心做的是存储、标准化、查询，不是计算，Python 在此场景无性能优势
2. **代码量大** — 125K+ 字符，6 个数据子域，重写 ROI 极低
3. **独立部署** — 数据中心是通用数据服务，可独立部署供多项目消费，TypeScript 生态更稳定
4. **Python 可直接读 SQLite** — 通过 thin data client 读 `data/quant.db`，无需 HTTP 中转，没有技术障碍

---

## 依赖链

```
Phase 1: strategy-runtime-py（纯 Python，无外部依赖）
    ↓
Phase 2: backtest-engine-py（依赖 strategy-runtime-py）
    ↓
Phase 3: factor-lab-py（依赖 strategy-runtime-py + numpy/pandas）
    ↓
Phase 4: ai-engine-py（依赖 strategy-runtime-py + numpy/pandas/scikit-learn）
    ↓
Phase 5: strategies-py（依赖 strategy-runtime-py）
    ↓
Phase 6: data-client-py（依赖 strategy-runtime-py 的行情类型）
    ↓
Phase 7: CLI 入口 + Worker 集成（依赖所有 Python 包）
    ↓
Phase 8: TS 类型壳 + 清理
```

---

## 类型一致性规则

- Python 用 `snake_case`，序列化给 TS 时转 `camelCase`
- 枚举值保持字符串一致（如 `OrderSide.Buy = "buy"`）
- 核心类型归属：

| Python 类型 | 所有者包 |
|------------|---------|
| Order, Trade, OrderRequest, Position, Account | strategy-runtime-py |
| Bar, Tick, TimeFrame | strategy-runtime-py (re-export) |
| StrategyMeta, StrategyParamDef, StrategyState | strategy-runtime-py |
| BacktestConfig, BacktestResult, BacktestMetrics | backtest-engine-py |
| FactorDefinition, FactorMetrics, FactorEvaluationResult | factor-lab-py |
| TrainConfig, ModelMetrics, PredictionResult | ai-engine-py |

---

## Phase 1: Python 策略运行时

> 纯 Python，无外部依赖。定义策略接口、订单类型、持仓、上下文等核心抽象。

### Task 1: 策略运行时包

**Files:**
- `packages/strategy-runtime-py/pyproject.toml`
- `packages/strategy-runtime-py/quantforge_strategy/__init__.py`
- `packages/strategy-runtime-py/quantforge_strategy/types.py` — 枚举（OrderSide, OrderType, OrderStatus, StrategyState, ParamType, ResearchMode, TimeFrame, TaskType, TaskStatus）
- `packages/strategy-runtime-py/quantforge_strategy/order.py` — Order, Trade, OrderRequest
- `packages/strategy-runtime-py/quantforge_strategy/portfolio.py` — Position, Account
- `packages/strategy-runtime-py/quantforge_strategy/market.py` — Bar, Tick（re-export from data-center）
- `packages/strategy-runtime-py/quantforge_strategy/context.py` — StrategyContext Protocol
- `packages/strategy-runtime-py/quantforge_strategy/strategy.py` — Strategy ABC + StrategyResult
- `packages/strategy-runtime-py/quantforge_strategy/meta.py` — StrategyMeta, StrategyParamDef
- `packages/strategy-runtime-py/quantforge_strategy/error.py` — QuantError
- `packages/strategy-runtime-py/quantforge_strategy/serialization.py` — to_camel_dict / from_camel_dict
- `packages/strategy-runtime-py/tests/test_types.py`
- `packages/strategy-runtime-py/tests/test_order.py`
- `packages/strategy-runtime-py/tests/test_strategy.py`
- `packages/strategy-runtime-py/tests/test_serialization.py`

- [ ] **Step 1:** 创建 `pyproject.toml`（name=quantforge-strategy, 无外部依赖）
- [ ] **Step 2:** 实现 `types.py` — 所有枚举，值与 TS 侧对齐
- [ ] **Step 3:** 实现 `order.py` — Order(frozen dataclass), Trade, OrderRequest
- [ ] **Step 4:** 实现 `portfolio.py` — Position, Account
- [ ] **Step 5:** 实现 `market.py` — Bar, Tick（字段与 TS data-center 对齐）
- [ ] **Step 6:** 实现 `context.py` — StrategyContext Protocol（submit_order, get_position, get_account, log）
- [ ] **Step 7:** 实现 `strategy.py` — Strategy ABC（meta, state, init, on_bar, on_tick, on_order, finish）
- [ ] **Step 8:** 实现 `meta.py` — StrategyMeta, StrategyParamDef
- [ ] **Step 9:** 实现 `error.py` — QuantError(code, message, detail)
- [ ] **Step 10:** 实现 `serialization.py` — snake_case↔camelCase 互转
- [ ] **Step 11:** 实现 `__init__.py` — 统一导出
- [ ] **Step 12:** 编写测试并运行 `pytest`

**验收:** `cd packages/strategy-runtime-py && python -m pytest tests/ -v` 全部通过

---

## Phase 2: Python 回测引擎

> 依赖 strategy-runtime-py。实现事件回放、撮合模拟、持仓管理、指标计算、结果导出。

### Task 2: 回测引擎包

**Files:**
- `packages/backtest-engine-py/pyproject.toml`
- `packages/backtest-engine-py/quantforge_backtest/__init__.py`
- `packages/backtest-engine-py/quantforge_backtest/types.py` — BacktestConfig, BacktestMetrics, BacktestResult, EquityPoint, DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE
- `packages/backtest-engine-py/quantforge_backtest/matcher.py` — Matcher（撮合器）
- `packages/backtest-engine-py/quantforge_backtest/portfolio.py` — PortfolioManager（持仓+资金管理）
- `packages/backtest-engine-py/quantforge_backtest/replay.py` — BarReplay（行情回放）
- `packages/backtest-engine-py/quantforge_backtest/metrics.py` — calc_metrics（年化收益、夏普、最大回撤等）
- `packages/backtest-engine-py/quantforge_backtest/runner.py` — BacktestRunner（编排全部流程）
- `packages/backtest-engine-py/tests/test_matcher.py`
- `packages/backtest-engine-py/tests/test_portfolio.py`
- `packages/backtest-engine-py/tests/test_metrics.py`
- `packages/backtest-engine-py/tests/test_runner.py`

- [ ] **Step 1:** 创建 `pyproject.toml`（依赖 quantforge-strategy）
- [ ] **Step 2:** 实现 `types.py` — BacktestConfig, BacktestMetrics, BacktestResult, EquityPoint
- [ ] **Step 3:** 实现 `matcher.py` — Matcher（Market/Limit 单撮合，滑点处理）
- [ ] **Step 4:** 实现 `portfolio.py` — PortfolioManager（持仓更新、资金曲线、equity points）
- [ ] **Step 5:** 实现 `replay.py` — BarReplay（排序、按时间回放 Bar）
- [ ] **Step 6:** 实现 `metrics.py` — 年化收益率、夏普比率、最大回撤、胜率、盈亏比等
- [ ] **Step 7:** 实现 `runner.py` — BacktestRunner.run() 编排：初始化→逐bar回放→撮合→指标→结果
- [ ] **Step 8:** 实现 `__init__.py` — 统一导出
- [ ] **Step 9:** 编写测试并运行 `pytest`

**验收:** 用 SimpleStrategy 跑完整回测，结果包含 metrics 和 equity curve

---

## Phase 3: Python 因子工坊

> 依赖 strategy-runtime-py + numpy/pandas。实现因子定义、计算、评估接口。因子评估指标（IC、分组收益、分层回测）的计算委托给回测引擎。

### Task 3: 因子工坊包

**Files:**
- `packages/factor-lab-py/pyproject.toml`
- `packages/factor-lab-py/quantforge_factor/__init__.py`
- `packages/factor-lab-py/quantforge_factor/types.py` — FactorDefinition, FactorStatus, FactorMetrics, FactorEvaluationResult
- `packages/factor-lab-py/quantforge_factor/factor.py` — Factor ABC（definition, compute）
- `packages/factor-lab-py/quantforge_factor/evaluator.py` — FactorEvaluator（IC、Rank IC、分组收益；分层回测委托 backtest-engine-py）
- `packages/factor-lab-py/tests/test_factor.py`
- `packages/factor-lab-py/tests/test_evaluator.py`

- [ ] **Step 1:** 创建 `pyproject.toml`（依赖 quantforge-strategy, numpy, pandas）
- [ ] **Step 2:** 实现 `types.py` — FactorDefinition, FactorStatus, FactorMetrics, FactorEvaluationResult
- [ ] **Step 3:** 实现 `factor.py` — Factor ABC（definition → FactorDefinition, compute → pd.Series）
- [ ] **Step 4:** 实现 `evaluator.py` — FactorEvaluator（IC 曲线、Rank IC、排序分组收益；分层回测调用 backtest-engine-py）
- [ ] **Step 5:** 实现 `__init__.py` — 统一导出
- [ ] **Step 6:** 编写测试并运行 `pytest`

**验收:** 定义一个简单动量因子，计算并评估，输出 IC 和分组收益

---

## Phase 4: Python AI 引擎

> 依赖 strategy-runtime-py + numpy/pandas/scikit-learn。实现特征提取、标签生成、模型训练和预测。

### Task 4: AI 引擎包

**Files:**
- `packages/ai-engine-py/pyproject.toml`
- `packages/ai-engine-py/quantforge_ai/__init__.py`
- `packages/ai-engine-py/quantforge_ai/types.py` — ModelType, LabelType, TrainConfig, ModelMetrics, PredictionResult
- `packages/ai-engine-py/quantforge_ai/features.py` — FeatureExtractor（收益率、波动率、成交量特征）
- `packages/ai-engine-py/quantforge_ai/model.py` — ModelTrainer（训练、评估、预测）
- `packages/ai-engine-py/quantforge_ai/predictor.py` — AIPredictor（封装特征+训练+预测）
- `packages/ai-engine-py/tests/test_features.py`
- `packages/ai-engine-py/tests/test_model.py`

- [ ] **Step 1:** 创建 `pyproject.toml`（依赖 quantforge-strategy, numpy, pandas, scikit-learn）
- [ ] **Step 2:** 实现 `types.py` — ModelType, TrainConfig, ModelMetrics, PredictionResult
- [ ] **Step 3:** 实现 `features.py` — FeatureExtractor（returns, volatility, volume_features, extract_all）
- [ ] **Step 4:** 实现 `model.py` — ModelTrainer（train → ModelMetrics, predict, predict_proba）
- [ ] **Step 5:** 实现 `predictor.py` — AIPredictor（train + predict 统一入口）
- [ ] **Step 6:** 实现 `__init__.py` — 统一导出
- [ ] **Step 7:** 编写测试并运行 `pytest`

**验收:** 用随机数据训练 RandomForest，输出 ModelMetrics 和 PredictionResult

---

## Phase 5: Python 策略库

> 依赖 strategy-runtime-py。实现具体策略和策略元数据。

### Task 5: 策略库包

**Files:**
- `packages/strategies-py/pyproject.toml`
- `packages/strategies-py/quantforge_strategies/__init__.py`
- `packages/strategies-py/quantforge_strategies/dual_ma.py` — DualMAStrategy（双均线策略）
- `packages/strategies-py/quantforge_strategies/rsi.py` — RSIStrategy（RSI 超买超卖策略）
- `packages/strategies-py/quantforge_strategies/registry.py` — 策略注册表（name → Strategy class）
- `packages/strategies-py/tests/test_dual_ma.py`
- `packages/strategies-py/tests/test_rsi.py`
- `packages/strategies-py/tests/test_registry.py`

- [ ] **Step 1:** 创建 `pyproject.toml`（依赖 quantforge-strategy）
- [ ] **Step 2:** 实现 `dual_ma.py` — 双均线策略（短均线上穿长均线买入，下穿卖出）
- [ ] **Step 3:** 实现 `rsi.py` — RSI 策略（RSI < 30 买入，RSI > 70 卖出）
- [ ] **Step 4:** 实现 `registry.py` — 策略注册表（register, get, list_all）
- [ ] **Step 5:** 实现 `__init__.py` — 统一导出 + 自动注册内置策略
- [ ] **Step 6:** 编写测试并运行 `pytest`

**验收:** 通过 registry 获取策略实例，用回测引擎跑完整回测

---

## Phase 6: Python 数据客户端

> 依赖 strategy-runtime-py。直接读取 data-center 的 SQLite 数据库，返回 Bar/Tick 等类型。无需 HTTP 中转。

### Task 6: 数据客户端包

**Files:**
- `packages/data-client-py/pyproject.toml`
- `packages/data-client-py/quantforge_data/__init__.py`
- `packages/data-client-py/quantforge_data/client.py` — DataClient（连接 SQLite，查询 Bar/Tick）
- `packages/data-client-py/quantforge_data/query.py` — 查询构建器（symbol, timeframe, 时间范围）
- `packages/data-client-py/tests/test_client.py`

- [ ] **Step 1:** 创建 `pyproject.toml`（依赖 quantforge-strategy；Python 标准库 sqlite3，无需额外依赖）
- [ ] **Step 2:** 实现 `client.py` — DataClient（get_bars, get_ticks, get_symbols；返回 strategy-runtime-py 的 Bar/Tick 类型）
- [ ] **Step 3:** 实现 `query.py` — BarQuery 构建器（symbol, timeframe, start_ts, end_ts）
- [ ] **Step 4:** 实现 `__init__.py` — 统一导出
- [ ] **Step 5:** 编写测试（用内存 SQLite 构造测试数据）并运行 `pytest`

**验收:** DataClient 读取 SQLite 返回 Bar 列表，字段与 TS 侧一致

---

## Phase 7: CLI 入口 + Worker 集成

> 为所有 Python 包提供 CLI 入口，Worker 通过子进程调用。

### Task 7: CLI 入口

**Files:**
- `packages/strategy-runtime-py/quantforge_strategy/cli.py` — CLI 入口（读取 stdin JSON，分发到对应引擎，输出 stdout JSON）
- `packages/strategy-runtime-py/quantforge_strategy/commands/backtest.py` — 回测命令
- `packages/strategy-runtime-py/quantforge_strategy/commands/factor_eval.py` — 因子评估命令
- `packages/strategy-runtime-py/quantforge_strategy/commands/ai_train.py` — AI 训练命令

- [ ] **Step 1:** 实现 `cli.py` — 主入口，解析 JSON 命令，分发到子命令
- [ ] **Step 2:** 实现 `commands/backtest.py` — 接收 {strategy, config, data_range}，返回 BacktestResult JSON
- [ ] **Step 3:** 实现 `commands/factor_eval.py` — 接收 {factor, data_range}，返回 FactorEvaluationResult JSON
- [ ] **Step 4:** 实现 `commands/ai_train.py` — 接收 {model_type, features, target}，返回 ModelMetrics JSON
- [ ] **Step 5:** 在 pyproject.toml 添加 `[project.scripts]` 入口点

**通信协议:**
```json
// stdin
{"command": "backtest", "strategy": "dual_ma", "config": {...}, "dataRange": {...}}

// stdout
{"ok": true, "data": {...}}
// 或
{"ok": false, "error": {"code": "...", "message": "..."}}
```

### Task 8: Worker 集成

**Files:**
- 修改: `apps/worker/src/python-bridge.ts` — Python 子进程调用器
- 修改: `apps/worker/src/handlers/backtest-handler.ts` — 调用 Python CLI 替代 TS 回测

- [ ] **Step 1:** 实现 `python-bridge.ts` — spawn Python 子进程，传入 JSON，解析输出
- [ ] **Step 2:** 修改 `backtest-handler.ts` — 通过 python-bridge 调用 CLI 回测
- [ ] **Step 3:** 编写 Worker 测试

**验收:** Worker 提交回测任务 → 调用 Python CLI → 返回 BacktestResult

---

## Phase 8: TS 类型壳 + 清理

> TS 侧旧包保留为类型壳（re-export 类型供 api/worker 使用），核心逻辑已迁移到 Python。

### Task 9: TS 类型壳

- [ ] **Step 1:** `packages/strategy-runtime/src/` — 删除实现代码，仅保留类型 re-export
- [ ] **Step 2:** `packages/backtest-engine/src/` — 删除实现代码，仅保留类型 re-export
- [ ] **Step 3:** `packages/factor-lab/src/` — 删除实现代码，仅保留类型 re-export
- [ ] **Step 4:** `packages/ai-engine/src/` — 删除实现代码，仅保留类型 re-export
- [ ] **Step 5:** `packages/strategies/src/` — 删除实现代码，仅保留类型 re-export
- [ ] **Step 6:** 运行 `pnpm build` 确认 TS 编译通过
- [ ] **Step 7:** 运行 `pnpm test` 确认现有测试仍通过（类型壳不需要逻辑测试）

**验收:** `pnpm build && pnpm test` 通过，TS 包只包含类型定义

---

## 执行策略

**推荐:** Subagent-Driven Development
- 每个 Task 分配一个独立 subagent
- Phase 内部串行（有依赖），Phase 间可并行（如 Phase 3/4/5 无互相依赖）
- 每个 Task 完成后运行测试验证

**并行机会:**
- Phase 3 (factor-lab-py) + Phase 4 (ai-engine-py) + Phase 5 (strategies-py) 可并行
- Phase 6 (data-client-py) 可与 Phase 3/4/5 并行
- Phase 7 (obsidian-sync-py) 需等 Phase 2/3/6 完成后才能开始
