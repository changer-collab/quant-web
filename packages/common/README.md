# packages/common

`packages/common` 是跨模块共享的公共类型、配置、错误和工具模块。

## 当前阶段

```text
已实现核心类型基座
```

## 已完成

```text
- 行情类型：TimeFrame、Instrument、Bar、Tick、MarketEvent
- 订单类型：OrderSide、OrderType、OrderStatus、Order
- 持仓账户类型：Trade、Position、Account
- 任务和回测类型：ResearchMode、TaskStatus、TaskType、BacktestConfig、BacktestMetrics、BacktestResult、EquityPoint
- 策略参数类型：ParamType、StrategyParamDef
- 错误类：QuantError
- 常量：DEFAULT_INITIAL_CASH、DEFAULT_SLIPPAGE
- 统一导出：src/index.ts
- TypeScript 编译和 Vitest 测试已配置
- 14 个测试用例通过
```

## 职责

```text
公共类型
公共配置
错误类型
轻量工具函数
跨模块共享常量
```

## 不负责

```text
业务流程
回测逻辑
策略逻辑
AI 训练逻辑
数据中心实现
前端页面
```

## 设计原则

保持小而稳定，不把 `common` 变成业务垃圾桶。

## 验证

```bash
pnpm --filter @quant/common build
pnpm --filter @quant/common test
```
