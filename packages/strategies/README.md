# packages/strategies

`packages/strategies` 是策略库，基于 `@quant/strategy-runtime` 接口实现具体交易策略，每个策略可独立加载到回测引擎运行。

## 当前阶段

```text
已实现双均线策略和 RSI 策略，12 个测试通过
```

## 已实现策略

| 策略 | 文件 | 说明 |
|---|---|---|
| DualMAStrategy | `src/dual-ma.ts` | 双均线策略：快线上穿慢线买入，下穿卖出 |
| RSIStrategy | `src/rsi.ts` | RSI 策略：RSI 低于超卖线买入，高于超买线卖出 |

## 策略接口

所有策略实现 `Strategy` 接口（来自 `@quant/strategy-runtime`）：

```typescript
interface Strategy {
  readonly meta: StrategyMeta;
  readonly state: StrategyState;
  init(context: StrategyContext): void;
  onBar(bar: Bar, context: StrategyContext): void;
  finish(): StrategyResult;
}
```

## 使用示例

```typescript
import { DualMAStrategy, RSIStrategy } from '@quant/strategies';
import { BacktestRunner } from '@quant/backtest-engine';

const strategy = new DualMAStrategy({ fastPeriod: 5, slowPeriod: 10 });
const runner = new BacktestRunner({ strategy, bars: [...], initialCash: 1_000_000 });
const result = runner.run();
```

## 不负责

```text
策略运行时协议定义
回测撮合
数据中心清洗
HTTP API
真实下单
```

## 依赖方向

允许：

```text
packages/strategies -> @quant/common
packages/strategies -> @quant/strategy-runtime
```

禁止：

```text
packages/strategies -> @quant/backtest-engine（策略不依赖回测引擎）
packages/strategies -> @quant/factor-lab（策略不依赖因子工坊）
packages/strategies -> apps/api
```
