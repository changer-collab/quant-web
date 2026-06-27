# packages/strategy-runtime

`packages/strategy-runtime`（`quantforge-strategy`）是 QuantForge 的策略运行时核心，定义策略接口、上下文、生命周期、订单类型、持仓账户和 CLI 入口。它是 Worker 通过 PythonBridge 调用 Python 子进程的唯一入口。

## 当前阶段

```text
策略运行时完整实现，CLI 支持 NDJSON 流式输出（progress/log/result/error 事件）
```

## 已完成

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

## 子模块

| 模块 | 文件 | 职责 |
|------|------|------|
| 类型定义 | `types.py` | 枚举类型（OrderSide、TimeFrame、TaskStatus 等），与 TS 侧对齐 |
| 行情类型 | `market.py` | Bar、Tick、Instrument、MarketEvent（re-export 给下游） |
| 订单 | `order.py` | Order、Trade、OrderRequest |
| 持仓 | `portfolio.py` | Position、Account |
| 策略元数据 | `meta.py` | StrategyParamDef、StrategyMeta |
| 策略上下文 | `context.py` | StrategyContext（策略运行时上下文） |
| 策略结果 | `result.py` | StrategyResult |
| 策略基类 | `strategy.py` | Strategy ABC（init/on_bar/on_tick/on_order/finish） |
| 分层策略 | `selectors.py` `timers.py` `sizers.py` `composite.py` | 选股/择时/仓位/组合策略基类 |
| 序列化 | `serialization.py` | camelCase/snake_case 互转 |
| 错误 | `error.py` | QuantError |
| CLI | `cli.py` `__main__.py` | stdin JSON → stdout NDJSON 事件流 |
| 命令 | `commands/backtest.py` `commands/factor_eval.py` `commands/ai_train.py` | 命令实现（延迟导入下游包） |

## 核心设计

- **接口优先稳定**：Strategy ABC 是所有策略的基类，init/on_bar/finish 为抽象方法，on_tick/on_order 有默认实现
- **分层策略**：SelectorStrategy（选股）、TimingStrategy（择时）、PositionStrategy（仓位）、CompositeStrategy（组合），支持可组合的策略架构
- **CLI 流式输出**：stdin 读取 JSON 请求，stdout 输出 NDJSON 事件流（progress/log/result/error），Worker 通过 PythonBridge 流式读取
- **延迟导入**：CLI 命令通过延迟导入加载下游包（backtest-engine、factor-lab、ai-engine、strategies、data-client），strategy-runtime 本身不依赖它们
- **因子公式委托**：factorEval 只做命令编排，公式解析和计算委托给 factor-lab 的 `FormulaFactor`
- **类型 re-export**：re-export data-client 的行情类型（Bar、Tick、TimeFrame 等），供下游模块通过合法依赖链获取

## CLI 通信协议

```text
stdin:  JSON 请求 {"command":"backtest","strategy":"dual_ma","config":{...},"dataRange":{...}}
stdout: NDJSON 事件流，每行一个 JSON 事件
        {"event":"progress","percent":30,"message":"..."}
        {"event":"log","level":"info","message":"..."}
        {"event":"result","data":{...}}
        {"event":"error","error":{"code":"...","message":"..."}}
```

调用方式：

```bash
echo '{"command":"backtest",...}' | python -m quantforge_strategy.cli
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

## 验证

```bash
cd packages/strategy-runtime
pip install -e .
python -m pytest tests/ -v
```
