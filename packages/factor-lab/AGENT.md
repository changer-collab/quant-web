# packages/factor-lab/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 因子工坊只做因子定义、计算、评估和注册的类型与接口，不做回测撮合和策略执行。
- 因子评估指标（IC、Rank IC、排序分组收益）当前由 factor-lab 的 `evaluator.py` 自算；分层回测委托给回测引擎（backtest-engine），不在 factor-lab 内实现撮合。
- 因子定义和计算接口优先稳定，避免过度抽象。
- 不引入 HTTP 入口或 CLI 入口；factor-lab 通过 strategy-runtime CLI 的 `factorEval` 命令延迟导入被调用。
- 更新本目录能力或进度时，同步更新本目录 `README.md`（如存在）和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
因子工坊完整实现：Factor ABC + FormulaFactor（受限 AST 安全公式）+ FactorEvaluator（IC/Rank IC/分组收益/IC 胜率/多空收益），3 个测试文件覆盖
```

## 已有能力

```text
- Factor ABC（factor.py）：抽象基类，定义 definition 属性和 compute(df) -> pd.Series 接口
- FormulaFactor（formula.py）：基于受限 AST 的安全公式因子
  - 白名单列：open / high / low / close / volume / turnover
  - 白名单函数：pct_change / rolling_mean / rolling_std / shift / log / rank
  - 禁止 __、关键字参数、非数值常量、未知列/函数
  - 接收 FactorDefinition 或裸字符串
- FactorEvaluator（evaluator.py）：
  - IC（Pearson 相关）
  - Rank IC（Spearman 相关）
  - 分组收益（qcut 分 n_groups 组）
  - IC 胜率
  - 多空收益
  - 输出 FactorEvaluationResult
  - 分层回测委托 backtest-engine（当前未接入）
- 类型定义（types.py）：6 个核心类型
```

注：当前无独立因子注册表（registry）模块，因子定义通过 FactorDefinition dataclass 表达。

## 边界

只负责：

```text
因子定义类型（FactorDefinition / FactorStatus / FactorEvalTab）
因子抽象接口（Factor ABC）
公式因子解析与计算（FormulaFactor 受限 AST）
因子评估调度（IC / Rank IC / 分组收益 / IC 胜率 / 多空收益）
因子评估结果导出（FactorEvaluationResult）
```

不负责：

```text
分层回测撮合（委托 backtest-engine）
回测撮合与策略执行
数据采集与存储
模型训练（ai-engine 负责）
HTTP API（api 负责）
任务编排（worker 负责）
CLI 入口（strategy-runtime 负责）
因子持久化注册表（当前无独立 registry 模块）
```

## 拥有的类型

按 AGENTS.md 类型归属原则，factor-lab 拥有（定义在 `types.py`）：

```text
FactorDefinition, FactorStatus, FactorEvalTab,
FactorMetrics, FactorRow, FactorEvaluationResult
```

其他模块通过合法依赖链获取这些类型，不重复定义。

## 依赖

```text
quantforge-strategy（strategy-runtime）— TimeFrame、ResearchMode 类型
numpy, pandas
```

AGENTS.md 白名单允许 `factor-lab → data-client`，当前未实际依赖。

## 被依赖方向

```text
packages/obsidian-sync（builders/factor.py、sync.py 使用）
packages/strategy-runtime CLI（commands/factor_eval.py、commands/diagnostics/factor.py、commands/diagnostics/transitional.py 延迟导入）
apps/worker（通过 PythonBridge 间接调用）
```

依赖链：

```text
factor-lab → strategy-runtime（纯标准库）
```

## 调用方式

factor-lab 无 CLI 入口，通过 strategy-runtime CLI 间接调用：

```bash
echo '{"command":"factorEval",...}' | python -m quantforge_strategy.cli
```

## 边界偏差说明

AGENTS.md 称"因子评估指标（IC、分组收益、分层回测）的计算委托给 backtest-engine"，但实际 `evaluator.py` 自算 IC / Rank IC / 分组收益，仅分层回测待委托 backtest-engine。文档维护时需注意此偏差，待分层回测接入后统一口径。
