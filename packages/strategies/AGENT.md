# packages/strategies/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 策略库只写策略实现、策略样例和策略元数据，不直接依赖网站后端。
- AI 预测策略可依赖 AI 引擎加载已训练模型并生成信号，但不在策略库内训练模型。
- 策略实现通过 strategy-runtime 的分层基类（SelectorStrategy / TimingStrategy / PositionStrategy / CompositeStrategy）组合，不重复实现撮合或回测逻辑。
- 不引入 HTTP 入口或 CLI 入口；策略库通过 strategy-runtime CLI 的 `listStrategies` / `backtest` 命令延迟导入被调用。
- 更新本目录能力或进度时，同步更新本目录 `README.md`（如存在）和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
策略库完整实现：10 个内置策略（5 综合策略 + 1 AI 预测策略 + 1 选股 + 1 择时 + 2 仓位），自动注册，12 个测试文件覆盖
```

## 已有能力

```text
- 综合策略（combined/，继承 Strategy）：
  - DualMAStrategy（dual_ma）— NON_FACTOR / TREND_CTA
  - RSIStrategy — NON_FACTOR / TREND_CTA
  - BollingerBandStrategy — NON_FACTOR / TREND_CTA
  - MACDStrategy — NON_FACTOR / TREND_CTA
  - KDJStrategy — NON_FACTOR / TREND_CTA
  - AIPredictorStrategy（ai_predictor）— NON_FACTOR / E2E_AI_TIMESERIES
    继承 TimingStrategy，通过延迟导入 quantforge_ai.AIPredictor 加载已训练模型（不在库内训练）
- 分层策略：
  - MomentumSelector（momentum_selector）— FACTOR_BASED / LINEAR_MULTI_FACTOR（selectors/）
  - MACrossoverTiming（ma_crossover）— NON_FACTOR / TREND_CTA（timers/）
  - EqualWeightSizer、FixedFractionSizer — Position，无 category（sizers/）
- 策略注册（registry.py）：register / get / list_all，__init__.py 自动注册 10 个内置策略
- 指标库（indicators.py）：sma / ema / rsi / bollinger / macd / kdj / crossover 纯函数，仅用标准库
- 策略元数据：复用 strategy-runtime 的 StrategyMeta（name / description / modes / params / version / kind / category / subcategory）
```

注：`CompositeStrategy` 注册表类型签名接受，但当前无具体实现。`AIPredictorStrategy` 的 category 标为 `NON_FACTOR` 但 subcategory 为 `E2E_AI_TIMESERIES`（待统一口径）。

## 边界

只负责：

```text
策略实现（综合策略 / 分层策略）
策略样例
策略元数据
策略注册（registry）
技术指标纯函数（indicators）
```

不负责：

```text
回测撮合（backtest-engine 负责）
因子计算和评估（factor-lab 负责）
模型训练（ai-engine 负责，AI 预测策略只加载已训练模型）
数据读取（data-client 负责）
HTTP API（api 负责）
任务编排（worker 负责）
CLI 入口（strategy-runtime 负责）
```

## 拥有的类型

strategies 包不定义新业务类型，仅本地类型别名 `StrategyType`；其余均从 strategy-runtime 复用（StrategyMeta、StrategyParamDef、StrategyCategory、StrategySubcategory 等）。

## 依赖

```text
quantforge-strategy（strategy-runtime）— 策略基类、订单、持仓、元数据类型
quantforge-ai（ai-engine）— AI 预测策略延迟导入 AIPredictor 加载已训练模型
```

## 被依赖方向

```text
packages/strategy-runtime CLI（commands/list_strategies.py、commands/backtest.py 延迟导入 quantforge_strategies）
apps/worker（通过 PythonBridge 间接调用）
```

依赖链：

```text
strategies → strategy-runtime（纯标准库）
strategies → ai-engine（仅 AI 预测策略消费已训练模型/预测器）
```

## 调用方式

策略库无 CLI 入口，通过 strategy-runtime CLI 间接调用：

```bash
echo '{"command":"listStrategies"}' | python -m quantforge_strategy.cli
echo '{"command":"backtest","strategy":"dual_ma",...}' | python -m quantforge_strategy.cli
```

## 策略分类对照

按 AGENTS.md canonical 分类（Python / API / 前端三层逐字对齐）：

| 策略 | category | subcategory |
|---|---|---|
| dual_ma / rsi / bollinger_band / macd / kdj | non_factor | trend_cta |
| ai_predictor | non_factor | e2e_ai_timeseries |
| momentum_selector | factor_based | linear_multi_factor |
| ma_crossover | non_factor | trend_cta |
| equal_weight / fixed_fraction | —（Position 层，无 category） | — |
