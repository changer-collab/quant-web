# packages/backtest-engine/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 回测引擎只做模拟市场和结果计算。
- 不直接处理 HTTP 请求，不直接拥有数据中心。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
已实现核心回测管线（EventBus、MarketReplay、Matcher、Portfolio、Metrics、BacktestRunner），31 个测试通过
```

## 边界

只负责：

```text
事件总线（EventBus）
行情回放（MarketReplay）
撮合模拟（Matcher）
持仓管理（Portfolio）
指标计算（calculateMetrics）
回测运行（BacktestRunner）
结果导出
```

## 待扩展

```text
多标的回测增强
Tick 级回测
手续费模型
滑点模型增强（百分比 + 固定点）
因子评估指标计算（IC、Rank IC、排序分组收益、分层回测）
```
