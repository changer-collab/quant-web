# apps/api

`apps/api` 是后续 QuantForge 的 HTTP API 入口。

## 当前阶段

```text
未实现，仅保留项目目录和职责边界
```

## 后续职责

```text
策略元数据 API
研究任务 API
回测报告 API
实验结果 API
前端所需的查询入口
```

## 不负责

```text
数据中心内部实现
回测计算
AI 训练
低延迟实盘下单
前端页面逻辑
```

## 依赖方向

允许：

```text
apps/api -> packages/common
apps/api -> services/data-center
apps/api -> packages/strategies
```

禁止：

```text
apps/api 反向被 packages 依赖
apps/api 放入低延迟下单路径
```
