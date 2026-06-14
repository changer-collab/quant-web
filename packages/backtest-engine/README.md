# packages/backtest-engine

`packages/backtest-engine` 是事件驱动回测引擎，串联"行情回放 → 策略执行 → 撮合模拟 → 持仓管理 → 指标计算 → 结果导出"核心闭环。

## 当前阶段

```text
已实现核心回测管线，31 个测试通过
```

## 已实现模块

| 模块 | 文件 | 说明 |
|---|---|---|
| EventBus | `src/event-bus.ts` | 事件总线，on/off/emit/clear |
| MarketReplay | `src/replay.ts` | 行情回放，按 timestamp 升序发布 bar/tick 事件 |
| Matcher | `src/matcher.ts` | 撮合引擎，支持市价单（滑点）和限价单 |
| Portfolio | `src/portfolio.ts` | 持仓管理，买卖/加减仓/市价更新/权益计算 |
| calculateMetrics | `src/metrics.ts` | 收益率/年化收益/夏普比率/最大回撤/胜率 |
| BacktestRunner | `src/runner.ts` | 回测运行器，串联完整管线 |

## 架构

```text
BacktestRunner
  ├── EventBus（事件总线）
  ├── MarketReplay（行情回放）──emit bar──┐
  ├── Strategy（策略执行）←──on bar───────┤
  │     └── StrategyContext.submitOrder()  │
  ├── Matcher（撮合引擎）←──pending orders┤
  ├── Portfolio（持仓管理）←──trades──────┤
  └── calculateMetrics（指标计算）←──equityCurve
```

## 使用示例

```typescript
import { BacktestRunner } from '@quant/backtest-engine';
import { DualMAStrategy } from '@quant/strategies';

const runner = new BacktestRunner({
  strategy: new DualMAStrategy({ fastPeriod: 5, slowPeriod: 10 }),
  bars: [...], // Bar[]
  initialCash: 1_000_000,
  slippage: 0.001,
});

const result = runner.run();
// result.config    — 回测配置
// result.trades    — 成交记录
// result.equityCurve — 权益曲线
// result.metrics   — 回测指标
```

## 不负责

```text
HTTP API
数据中心清洗和存储
策略库管理
AI 模型训练
真实下单
```

## 依赖方向

允许：

```text
packages/backtest-engine -> @quant/common
packages/backtest-engine -> @quant/strategy-runtime
packages/backtest-engine -> @quant/factor-lab
```

禁止：

```text
packages/backtest-engine -> apps/api
packages/backtest-engine -> services/data-center
```
