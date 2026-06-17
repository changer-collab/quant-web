# apps/api/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 保持 API 层薄，不把回测、训练、数据清洗逻辑塞进 API。
- 因子 CRUD 只做 HTTP 入口，因子计算和评估逻辑不塞进 API。
- 不引入权限系统、微服务或复杂网关，除非用户明确要求。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
已实现（Fastify + TypeScript）
```

已实现路由：

- 策略查询（GET /api/strategies）
- 任务提交/查询（POST/GET /api/tasks）
- 因子 CRUD + 评估触发 + 批量计算（/api/factors）
- 数据摘要查询（/api/data/instruments|bars|coverage|quality）
- 任务服务通过 TaskService 接口解耦 Worker，当前使用 InMemoryTaskService

## 边界

API 只做 HTTP 入口和业务编排，不做：

```text
行情存储
事件驱动回测
模型训练
真实下单
低延迟执行
```