# apps/worker

`apps/worker` 是 QuantForge 的异步任务 Worker，独立进程部署，通过 HTTP 轮询 `apps/api` 领取任务、执行后上报结果。负责回测、因子计算、因子评估、诊断、数据采集和循环等异步任务的编排与执行，不承载核心算法。

## 当前阶段

```text
已实现：独立进程入口 + HTTP 轮询 API 领取任务 + 六个任务处理器
```

## 已实现

```text
- TaskHandler 接口：统一任务处理器契约（定义在 types.ts）
- BacktestHandler：回测任务处理器，通过 PythonBridge 调用 BacktestRunner
- CollectHandler：数据采集任务处理器，调用 data-collector
- DiagnosticsHandler：诊断任务处理器，通过 PythonBridge 调用 diagnostics CLI
- FactorComputeHandler：因子计算任务处理器，调用 FactorEngine 批量计算
- FactorEvalHandler：因子评估任务处理器，调用 FactorEvalScheduler 评估因子
- LoopHandler：循环任务处理器，编排多次子任务迭代
- main.ts 独立入口：通过 HTTP 轮询 /api/internal/tasks/* 领取、执行、上报任务，不依赖与 API 同进程
- PythonBridge：Python 子进程桥接器（stdin JSON → stdout NDJSON 事件流）
```

## 文件结构

```text
src/
├── main.ts                         # 独立进程入口（HTTP 轮询 API 领取任务）
├── types.ts                        # TaskHandler 接口、TaskType、TaskStatus 等类型
├── python-bridge.ts                # Python 子进程桥接器（stdin JSON → stdout NDJSON）
├── db-path.ts                      # 数据中心数据库路径解析（QUANT_DB_PATH 环境变量）
├── index.ts                        # 统一导出
└── handlers/
    ├── backtest-handler.ts         # 回测任务处理器
    ├── collect-handler.ts          # 数据采集任务处理器
    ├── diagnostics-handler.ts      # 诊断任务处理器
    ├── factor-compute-handler.ts   # 因子计算任务处理器
    ├── factor-eval-handler.ts      # 因子评估任务处理器
    └── loop-handler.ts             # 循环任务处理器
tests/
├── backtest-handler.test.ts        # 回测处理器测试
├── diagnostics-handler.test.ts     # 诊断处理器测试
└── e2e-pipeline.test.ts            # 端到端流水线测试
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

Worker 默认轮询 `http://127.0.0.1:3002/api/internal/tasks/pending`（可通过 `API_BASE_URL` 环境变量覆盖，轮询间隔由 `POLL_INTERVAL_MS` 控制，默认 1000ms），需先启动 `apps/api`。任务进度通过 SSE `/api/tasks/:id/stream` 推送给前端。
