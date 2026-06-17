# apps/worker

`apps/worker` 是 QuantForge 的异步任务 Worker，负责回测、因子计算和因子评估等异步任务的编排与执行。

## 当前阶段

```text
已实现：独立进程入口 + HTTP 轮询 API 领取任务 + 三个任务处理器 + Worker 主类
```

## 已实现

```text
- TaskQueue：内存任务队列，支持 submit/get/list/cancel/processNext/processAll
- TaskHandler 接口：统一任务处理器契约
- Worker 主类：组装 DataCenter 和 Handler，暴露 submit/getTask/listTasks/processAll/close
- BacktestHandler：回测任务处理器
- FactorComputeHandler：因子计算任务处理器
- FactorEvalHandler：因子评估任务处理器
- main.ts 独立入口：通过 HTTP 轮询 API /api/internal/tasks/* 领取、执行、上报任务
```

## 文件结构

```text
src/
├── main.ts                         # 独立进程入口（HTTP 轮询 API 领取任务）
├── queue.ts                        # 内存任务队列（TaskQueue + TaskHandler 接口）
├── worker.ts                       # Worker 主类
├── index.ts                        # 统一导出
└── handlers/
    ├── backtest-handler.ts         # 回测任务处理器
    ├── factor-compute-handler.ts   # 因子计算任务处理器
    └── factor-eval-handler.ts      # 因子评估任务处理器
tests/
├── queue.test.ts                   # 队列测试（8 个）
├── backtest-handler.test.ts        # 回测处理器测试（3 个）
└── worker.test.ts                  # Worker 主类测试（3 个）
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

## 不负责

```text
HTTP API
前端页面
数据中心内部清洗和存储
低延迟实盘下单
核心算法实现（策略逻辑、撮合模拟、模型算法）
```

## 运行

```bash
# 独立进程方式（推荐，前后端闭环）
cd apps/worker
npm run dev   # tsx watch src/main.ts
npm start     # tsx src/main.ts

# 单元测试 / 构建
pnpm --filter @quant/worker test
pnpm --filter @quant/worker build
```

Worker 默认轮询 `http://127.0.0.1:3000/api/internal/tasks/pending`，需先启动 `apps/api`。
