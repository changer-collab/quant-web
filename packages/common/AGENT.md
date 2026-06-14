# packages/common/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 当前目录尚未实现，新增内容前必须确认是否真的跨模块共享。
- 不把业务逻辑放进 common。
- 不为了复用提前抽象，优先保持简单。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
已实现核心类型基座
```

## 已有能力

```text
- 行情类型：TimeFrame、Instrument、Bar、Tick、MarketEvent
- 订单类型：OrderSide、OrderType、OrderStatus、Order
- 持仓账户类型：Trade、Position、Account
- 任务和回测类型：ResearchMode、TaskStatus、TaskType、BacktestConfig、BacktestMetrics、BacktestResult、EquityPoint
- 策略参数类型：ParamType、StrategyParamDef
- 错误类：QuantError
- 常量：DEFAULT_INITIAL_CASH、DEFAULT_SLIPPAGE
```

## 边界

只放：

```text
公共类型
公共配置
错误类型
轻量工具
共享常量
```
