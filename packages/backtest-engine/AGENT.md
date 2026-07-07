# packages/backtest-engine/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 回测引擎只做事件回放、撮合模拟、持仓、资金曲线、指标和结果导出，不直接读数据中心、不直接处理 HTTP、不实现策略逻辑。
- 不引入 HTTP 入口或 CLI 入口；回测引擎通过 strategy-runtime CLI 间接被 Worker 调用。
- 因子评估指标（IC、Rank IC、排序分组收益、分层回测）是回测引擎的合法能力，因子是回测引擎的一种输入维度（当前 IC/Rank IC/分组收益已由 factor-lab evaluator 自算，分层回测待回测引擎实现）。
- 更新本目录能力或进度时，同步更新本目录 `README.md`（如存在）和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
回测引擎完整实现，支持单标的/多标的/多策略组合回测，A股市场规则接入，11 个测试文件覆盖
```

## 已有能力

```text
- BacktestRunner：单标的逐 bar 回放，串联撮合、持仓、指标
- MultiSymbolRunner：多标的组合回测，按时间戳合并；含 per-symbol 子权益归因
- MultiStrategyRunner：多策略按权重分配资金，各自独立运行后合并权益
- Matcher：市价/限价撮合，涨跌停拦截、停牌、T+1、最小交易单位
- PortfolioManager：持仓、现金、T+1 解锁、交易成本扣减
- BarReplay：Bar/Tick 按时间戳排序工具
- metrics：夏普、索提诺、卡玛、最大回撤、回撤持续天数、年化波动率、胜率；FIFO round-trip 交易统计
- equity_stats：DrawdownPoint / MonthlyReturn / AnnualReturn + 回撤曲线 / 周期收益计算
- market_rules：MarketRules / ASHARE_RULES / NO_RULES（T+1、印花税、佣金、过户费、涨跌停价、最小交易单位）
- composite_impl：DefaultComposite — 编排 selector + timer + sizer 的组合策略默认实现
- 因子评估指标：AGENTS.md 声明为合法能力，当前代码尚未实现（IC/Rank IC/分组收益由 factor-lab 自算，分层回测待补）
```

## 边界

只负责：

```text
事件回放（Bar/Tick 按时间戳排序）
撮合模拟（市价/限价、涨跌停、停牌、T+1）
持仓和资金曲线管理
回测指标计算（夏普/索提诺/卡玛/回撤/胜率等）
权益衍生统计（回撤曲线、月度/年度收益）
A股市场规则接入（T+1/税费/涨跌停/最小单位）
结果导出（BacktestResult）
多标的/多策略组合运行
子权益归因
因子评估指标计算（合法能力，分层回测待实现）
```

不负责：

```text
直接读数据中心（data-client/data-center 负责）
直接处理 HTTP（api 负责）
策略实现（strategies 负责）
模型训练（ai-engine 负责）
数据采集（data-collector 负责）
任务编排（worker 负责）
因子定义和计算（factor-lab 负责）
CLI 入口（strategy-runtime 负责）
```

## 拥有的类型

按 AGENTS.md 类型归属原则，backtest-engine 拥有（定义在 `types.py`）：

```text
BacktestConfig, BacktestMetrics, BacktestResult, EquityPoint,
DEFAULT_INITIAL_CASH (= 1_000_000), DEFAULT_SLIPPAGE (= 0.0)
```

其他模块通过合法依赖链获取这些类型，不重复定义。

## 依赖

```text
quantforge-strategy（strategy-runtime）— 策略接口、订单、持仓类型
```

AGENTS.md 白名单允许 `backtest-engine → factor-lab`，当前未实际依赖（因子评估指标实现时再引入）。

## 被依赖方向

```text
packages/obsidian-sync → backtest-engine
packages/strategy-runtime CLI（commands/backtest.py、commands/sync_backtest.py 延迟导入）
apps/worker（通过 PythonBridge 间接调用，不直接 import）
```

依赖链：

```text
backtest-engine → strategy-runtime（纯标准库）
```

## 调用方式

回测引擎无 CLI 入口，通过 strategy-runtime CLI 间接调用：

```bash
echo '{"command":"backtest","strategy":"dual_ma","config":{...}}' | python -m quantforge_strategy.cli
```

Worker（TS）通过 PythonBridge 调用 `python -m quantforge_strategy.cli`，CLI 延迟导入 `quantforge_backtest` 执行回测。
