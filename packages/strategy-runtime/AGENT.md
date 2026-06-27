# packages/strategy-runtime/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 策略运行时只定义策略接口、上下文、生命周期和运行适配，不实现回测撮合、模型训练、数据采集。
- 接口优先稳定，避免过度抽象。
- 策略运行时可 re-export 数据客户端的行情类型（Bar、Tick、TimeFrame 等），供下游模块通过合法依赖链获取。
- CLI 入口是 Worker 子进程调用的唯一入口，不直接暴露 HTTP。
- CLI 命令通过延迟导入加载下游包，strategy-runtime 本身不依赖 backtest-engine、factor-lab、ai-engine、strategies、data-client。
- factorEval 只做命令编排；公式解析和计算委托给 factor-lab 的 `FormulaFactor`，不要在 strategy-runtime 内重复实现公式求值逻辑。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
策略运行时完整实现，CLI 支持 NDJSON 流式输出（progress/log/result/error 事件）
```

## 已有能力

```text
- 行情类型 re-export（TimeFrame、ResearchMode、Bar、Tick、Instrument、MarketEvent）
- 订单类型（OrderSide、OrderType、OrderStatus、Order、Trade、OrderRequest）
- 持仓账户（Position、Account）
- 策略参数（ParamType、StrategyParamDef、StrategyMeta）
- 任务类型（TaskStatus、TaskType）
- 错误类型（QuantError）
- 策略核心（Strategy ABC、StrategyContext、StrategyResult、StrategyState）
- 分层策略基类（SelectorStrategy、TimingStrategy、PositionStrategy、CompositeStrategy）
- 序列化工具（to_camel、to_snake、to_camel_dict、from_camel_dict）
- CLI 入口（cli.py，stdin JSON → stdout NDJSON 事件流）
- 命令分发（backtest、factorEval、aiTrain，延迟导入下游包）
```

## 边界

只负责：

```text
策略接口定义（Strategy ABC）
策略上下文（StrategyContext）
策略生命周期（init/on_bar/on_tick/on_order/finish）
分层策略基类（Selector/Timing/Position/Composite）
订单、持仓、账户类型定义
策略参数和元数据类型定义
任务状态和类型枚举
错误类型定义
CLI 入口和命令分发（延迟导入下游包）
行情类型 re-export（供下游合法依赖链获取）
```

## 不负责

```text
回测撮合（backtest-engine 负责）
因子计算和评估（factor-lab 负责）
模型训练和预测（ai-engine 负责）
策略实现（strategies 负责）
数据读取（data-client 负责）
数据存储和查询（data-center 负责）
HTTP API（api 负责）
任务编排（worker 负责）
```

## 拥有的类型

按 AGENTS.md 类型归属原则，strategy-runtime 拥有：

```text
OrderSide, OrderType, OrderStatus, Order,
Trade, Position, Account,
StrategyParamDef, ParamType,
TaskStatus, TaskType,
QuantError
```

其他模块通过合法依赖链获取这些类型，不重复定义。

## 依赖

```text
无运行时依赖（纯 Python 标准库）
```

CLI 命令运行时需要额外安装（延迟导入）：

```text
quantforge-backtest    — 回测引擎
quantforge-factor      — 因子工坊
quantforge-ai          — AI 引擎
quantforge-strategies  — 策略库
quantforge-data        — 数据客户端
```

## 被依赖方向

```text
packages/backtest-engine → strategy-runtime
packages/factor-lab → strategy-runtime
packages/strategies → strategy-runtime
packages/data-client → strategy-runtime（re-export 行情类型）
```

依赖链：

```text
strategy-runtime（无依赖，纯标准库）
```

## CLI 通信协议

```text
stdin:  JSON 请求
stdout: NDJSON 事件流（每行一个 JSON 事件）
        progress — 进度更新
        log      — 运行日志
        result   — 最终结果
        error    — 错误
```

Worker（TS）通过 PythonBridge 调用 `python -m quantforge_strategy.cli`，不直接 import Python 包。

Windows 中文环境下，CLI 子进程 stdout 已强制 UTF-8；测试中使用 `subprocess.run(..., text=True)` 时需显式传 `encoding="utf-8"`，避免系统默认 GBK 解码失败。
