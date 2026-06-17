# apps/api

`apps/api` 是 QuantForge 的 HTTP API 入口，基于 Fastify 实现。

## 当前阶段

```text
已实现（Fastify + TypeScript，21 个测试通过）
```

### 已实现路由

```text
策略：
  GET    /api/strategies             策略元数据列表
  GET    /api/strategies/:name       策略详情

任务：
  POST   /api/tasks                  提交研究/回测/因子任务
  GET    /api/tasks                  任务列表（可传 type/status 过滤）
  GET    /api/tasks/:id              任务状态和结果
  GET    /api/tasks/:id/stream       任务 SSE 流（progress/log/result/error）

内部 Worker 路由：
  GET    /api/internal/tasks/pending  Worker 获取 pending 任务列表
  POST   /api/internal/tasks/:id/claim Worker 认领任务
  POST   /api/internal/tasks/:id/event  Worker 上报进度/日志事件
  POST   /api/internal/tasks/:id/complete Worker 上报任务完成结果
  POST   /api/internal/tasks/:id/fail Worker 上报任务失败

因子：
  GET    /api/factors                因子注册列表
  POST   /api/factors                注册因子定义
  GET    /api/factors/:id            因子详情
  PUT    /api/factors/:id            更新因子定义
  DELETE /api/factors/:id            删除因子定义
  POST   /api/factors/:id/evaluate   触发因子评估（返回 taskId）
  POST   /api/factors/compute        触发批量因子计算（返回 taskId）

数据摘要（基于 DataCenter Provider）：
  GET    /api/data/instruments       标的元数据
  GET    /api/data/bars              K 线行情
  GET    /api/data/coverage          数据覆盖率
  GET    /api/data/quality           数据质量报告
```

### 设计要点

- 保持 API 层薄：不做数据清洗、回测计算、模型训练。
- 通过 `TaskService` 接口解耦 Worker 实现；当前使用 `InMemoryTaskService` 内存实现。
- 因子评估和批量计算触发后返回异步任务 ID，任务状态可通过任务路由查询。
- 数据查询委托给 DataCenter 的 Provider 层。

## 后续职责

```text
- 前端所需查询入口增强
- 批量导出和报告下载
- TaskService 持久化实现（替换 InMemoryTaskService）
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
apps/api -> services/data-center
apps/api -> packages/strategy-runtime
apps/api -> packages/strategies
apps/api -> packages/factor-lab
```

禁止：

```text
apps/api 反向被 packages 依赖
apps/api 放入低延迟下单路径
```

## 验证

```bash
cd apps/api
pnpm test
```