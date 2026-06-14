# packages/strategy-runtime

`packages/strategy-runtime` 定义策略运行时接口：策略接口、上下文、元数据、运行结果和生命周期状态。

## 当前阶段

```text
已实现核心接口和类型定义，测试通过
```

## 导出

| 导出 | 类型 | 来源 |
|------|------|------|
| `StrategyState` | enum | `src/types.ts` |
| `OrderRequest` | interface | `src/types.ts` |
| `StrategyMeta` | interface | `src/meta.ts` |
| `StrategyContext` | interface | `src/context.ts` |
| `LogLevel` | type | `src/context.ts` |
| `StrategyResult` | interface | `src/result.ts` |
| `Strategy` | interface | `src/strategy.ts` |

## 核心接口

- **Strategy** — 策略核心接口，定义 `init`/`onBar`/`onTick?`/`onOrder?`/`finish` 生命周期
- **StrategyContext** — 策略运行时上下文，提供 `submitOrder`/`getPosition`/`getAccount`/`log`
- **StrategyMeta** — 策略元数据，包含名称、描述、支持模式、参数定义和版本
- **StrategyResult** — 策略运行输出，包含 meta、orders、trades 和可选 customOutput
- **StrategyState** — 策略状态枚举：Idle/Running/Stopped/Error

## 依赖

```text
@quant/common
```

## 不负责

```text
具体策略实现
回测撮合
数据中心清洗
HTTP API
真实下单
```

## 被依赖方向

```text
packages/backtest-engine -> packages/strategy-runtime
packages/strategies -> packages/strategy-runtime
apps/worker -> packages/strategy-runtime
```
