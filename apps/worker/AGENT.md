# apps/worker/AGENT.md

## 必须遵守

- 所有回复使用中文。
- Worker 负责异步任务编排，不负责核心算法实现。
- 不把低延迟实盘下单放进普通 Worker。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
已实现：独立进程入口 + HTTP 轮询 API 领取任务 + 三个任务处理器 + Worker 主类
```

## 已实现

```text
- TaskQueue：内存任务队列，支持 submit/get/list/cancel/processNext/processAll
- TaskHandler 接口：统一任务处理器契约
- Worker 主类：组装 DataCenter 和 Handler，暴露 submit/getTask/listTasks/processAll/close
- BacktestHandler：回测任务处理器，从 DataCenter 加载行情，调用 BacktestRunner 执行回测
- FactorComputeHandler：因子计算任务处理器，从 DataCenter 加载行情，调用 FactorEngine 批量计算
- FactorEvalHandler：因子评估任务处理器，调用 FactorEvalScheduler 评估因子
- main.ts 独立入口：通过 HTTP 轮询 API /api/internal/tasks/* 领取、执行、上报任务，不依赖与 API 同进程
- 14 个测试通过
```

## 边界

Worker 可以编排：

```text
回测任务
训练任务
因子计算任务
因子评估任务
报告产物生成
```

Worker 不直接负责：

```text
策略逻辑
撮合模拟
模型算法
行情清洗
实盘下单
```

## 依赖方向

允许：

```text
apps/worker -> services/data-center
apps/worker -> packages/strategy-runtime
apps/worker -> packages/backtest-engine
apps/worker -> packages/ai-engine
apps/worker -> packages/factor-lab
```

## 运行方式

```bash
cd apps/worker
npm run dev   # tsx watch src/main.ts
npm start     # tsx src/main.ts
```

Worker 默认轮询 `http://127.0.0.1:3000/api/internal/tasks/pending`。

## 后续扩展

```text
- 替换内存队列为 Redis/BullMQ 持久化队列
- 添加任务优先级和并发控制
- 添加 AI 训练任务处理器（依赖 ai-engine）
- 添加任务进度回调（当前通过 SSE /api/tasks/:id/stream 推送）
```
