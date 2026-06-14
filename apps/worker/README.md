# apps/worker

`apps/worker` 是后续 QuantForge 的异步任务 Worker。

## 当前阶段

```text
未实现，仅保留项目目录和职责边界
```

## 后续职责

```text
运行回测任务
运行模型训练任务
运行实验扫描任务
读取数据中心结果
调用策略运行时
调用回测引擎
调用 AI 引擎
输出任务状态和报告产物
```

## 不负责

```text
HTTP API
前端页面
数据中心内部清洗和存储
低延迟实盘下单
```

## 依赖方向

允许：

```text
apps/worker -> services/data-center
apps/worker -> packages/strategy-runtime
apps/worker -> packages/backtest-engine
apps/worker -> packages/ai-engine
```
