# apps/worker/AGENT.md

## 必须遵守

- 所有回复使用中文。
- Worker 负责异步任务编排，不负责核心算法实现。
- 不把低延迟实盘下单放进普通 Worker。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
已实现：独立进程入口 + HTTP 轮询 API 领取任务 + 六个任务处理器
```

## 已实现

```text
- TaskHandler 接口：统一任务处理器契约（定义在 types.ts）
- BacktestHandler：回测任务处理器，从 DataCenter 加载行情，调用 BacktestRunner 执行回测
- DiagnosticsHandler：诊断任务处理器，通过 PythonBridge 调用 diagnostics CLI
- FactorComputeHandler：因子计算任务处理器，从 DataCenter 加载行情，调用 FactorEngine 批量计算
- FactorEvalHandler：因子评估任务处理器，调用 FactorEvalScheduler 评估因子
- CollectHandler：数据采集任务处理器，调用 data-collector
- LoopHandler：循环任务处理器，编排多次子任务迭代
- main.ts 独立入口：通过 HTTP 轮询 API /api/internal/tasks/* 领取、执行、上报任务，不依赖与 API 同进程
- queue.ts（含 TaskQueue + better-sqlite3 本地队列）已删除，被 HTTP 轮询替代
- worker.ts（Worker 主类）已删除，为死代码
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

Worker 默认轮询 `http://127.0.0.1:3002/api/internal/tasks/pending`。

## 后续扩展

```text
- 替换内存队列为 Redis/BullMQ 持久化队列
- 添加任务优先级和并发控制
- 添加 AI 训练任务处理器（依赖 ai-engine）
- 添加任务进度回调（当前通过 SSE /api/tasks/:id/stream 推送）
```
