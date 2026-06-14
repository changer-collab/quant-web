# packages/strategy-runtime/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 运行时只定义和适配策略运行协议，不承载具体策略库。
- 保持接口稳定和简单，不做过度抽象。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。
- 修改后运行 `pnpm test`、`pnpm run build` 验证。

## 当前阶段

```text
已实现核心接口：Strategy、StrategyContext、StrategyMeta、StrategyResult、StrategyState、OrderRequest
测试通过，编译通过
```

## 边界

只处理：

```text
策略接口 (Strategy)
策略上下文 (StrategyContext)
策略元数据 (StrategyMeta)
运行结果 (StrategyResult)
策略状态 (StrategyState)
订单请求 (OrderRequest)
```

## 依赖

```text
@quant/common — 公共类型（OrderSide, OrderType, Bar, Tick, Order, Trade, Position, Account, ResearchMode, StrategyParamDef）
```
