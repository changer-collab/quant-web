# packages/strategies/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 策略代码不直接依赖网站后端。
- 策略库只放策略实现和策略元数据，不放回测引擎。
- 新增策略必须实现 `Strategy` 接口（来自 `@quant/strategy-runtime`）。
- 策略不依赖 `@quant/backtest-engine`，策略通过 `StrategyContext` 与引擎交互。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
已实现双均线策略（DualMAStrategy）和 RSI 策略（RSIStrategy），12 个测试通过
```

## 边界

可放：

```text
传统量化策略（均线、动量、均值回归等）
高频研究策略
AI 量化策略
策略样例
策略元数据
```

## 待扩展

```text
多因子选股策略
动量策略
均值回归策略
布林带策略
MACD 策略
```
