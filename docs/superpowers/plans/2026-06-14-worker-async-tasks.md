# Task 2: Worker 异步任务编排实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Worker 异步任务编排，支持回测任务和因子计算任务的提交、执行和状态查询。当前阶段使用内存队列（不引入 Redis/BullMQ），保持简单可测试。

**Architecture:** 内存任务队列 TaskQueue + TaskHandler 接口 + Worker 主类。Worker 组装数据中心、因子引擎和策略工厂，注册处理器，对外暴露 submit/getTask/listTasks/processAll 接口。API 层通过 Worker 接口提交和查询任务。

**Tech Stack:** TypeScript, Vitest, @quant/common, @quant/data-center, @quant/strategy-runtime, @quant/backtest-engine, @quant/factor-lab

---

## 依赖关系

```text
apps/worker -> @quant/common
apps/worker -> @quant/data-center
apps/worker -> @quant/strategy-runtime
apps/worker -> @quant/backtest-engine
apps/worker -> @quant/factor-lab
apps/api -> apps/worker
```

---

## 文件结构

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| 修改 | `apps/worker/package.json` | 添加依赖和脚本 |
| 新建 | `apps/worker/tsconfig.json` | TypeScript 配置 |
| 新建 | `apps/worker/vitest.config.ts` | Vitest 配置 |
| 新建 | `apps/worker/src/queue.ts` | 内存任务队列 |
| 新建 | `apps/worker/src/handlers/backtest-handler.ts` | 回测任务处理器 |
| 新建 | `apps/worker/src/handlers/factor-compute-handler.ts` | 因子计算任务处理器 |
| 新建 | `apps/worker/src/handlers/factor-eval-handler.ts` | 因子评估任务处理器 |
| 新建 | `apps/worker/src/worker.ts` | Worker 主类 |
| 新建 | `apps/worker/src/index.ts` | 统一导出 |
| 新建 | `apps/worker/tests/queue.test.ts` | 队列测试 |
| 新建 | `apps/worker/tests/backtest-handler.test.ts` | 回测处理器测试 |
| 新建 | `apps/worker/tests/worker.test.ts` | Worker 主类测试 |

---

## Task 1: 更新 package.json 和配置文件

**Files:**
- Modify: `apps/worker/package.json`
- Create: `apps/worker/tsconfig.json`
- Create: `apps/worker/vitest.config.ts`

- [ ] **Step 1: 更新 package.json**

```json
{
  "name": "@quant/worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "lint": "eslint src/ tests/",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@quant/common": "workspace:*",
    "@quant/data-center": "workspace:*",
    "@quant/strategy-runtime": "workspace:*",
    "@quant/backtest-engine": "workspace:*",
    "@quant/factor-lab": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^3.2.6",
    "tsx": "^4.19.0"
  }
}
```

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
```

- [ ] **Step 4: 运行 pnpm install**

Run: `pnpm install`
Expected: 依赖安装成功

---

## Task 2: 创建 src/queue.ts — 内存任务队列

**Files:**
- Create: `apps/worker/src/queue.ts`

- [ ] **Step 1: 创建内存任务队列**

```typescript
import { TaskStatus, TaskType } from '@quant/common';

/** 任务记录 */
export interface TaskRecord {
  id: string;
  type: TaskType;
  status: TaskStatus;
  payload: Record<string, unknown>;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
}

/** 任务处理器接口 */
export interface TaskHandler {
  readonly type: TaskType;
  handle(task: TaskRecord): Promise<Record<string, unknown>>;
}

/** 内存任务队列 */
export class TaskQueue {
  private readonly tasks = new Map<string, TaskRecord>();
  private readonly handlers = new Map<TaskType, TaskHandler>();
  private idCounter = 0;

  /** 注册任务处理器 */
  registerHandler(handler: TaskHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /** 提交任务 */
  submit(type: TaskType, payload: Record<string, unknown>): TaskRecord {
    const id = `task-${++this.idCounter}`;
    const task: TaskRecord = {
      id, type, status: TaskStatus.Pending, payload,
      submittedAt: Date.now(),
    };
    this.tasks.set(id, task);
    return task;
  }

  /** 获取任务 */
  get(taskId: string): TaskRecord | undefined {
    return this.tasks.get(taskId);
  }

  /** 列出任务（按类型筛选） */
  list(type?: TaskType): TaskRecord[] {
    const all = Array.from(this.tasks.values());
    return type ? all.filter((t) => t.type === type) : all;
  }

  /** 取消任务（仅 Pending 状态可取消） */
  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== TaskStatus.Pending) return false;
    task.status = TaskStatus.Cancelled;
    task.completedAt = Date.now();
    return true;
  }

  /** 执行下一个待处理任务 */
  async processNext(): Promise<TaskRecord | undefined> {
    for (const task of this.tasks.values()) {
      if (task.status !== TaskStatus.Pending) continue;
      const handler = this.handlers.get(task.type);
      if (!handler) continue;
      task.status = TaskStatus.Running;
      task.startedAt = Date.now();
      try {
        task.result = await handler.handle(task);
        task.status = TaskStatus.Completed;
      } catch (err) {
        task.error = String(err);
        task.status = TaskStatus.Failed;
      }
      task.completedAt = Date.now();
      return task;
    }
    return undefined;
  }

  /** 执行所有待处理任务 */
  async processAll(): Promise<TaskRecord[]> {
    const processed: TaskRecord[] = [];
    while (true) {
      const task = await this.processNext();
      if (!task) break;
      processed.push(task);
    }
    return processed;
  }
}
```

---

## Task 3: 创建 src/handlers/backtest-handler.ts

**Files:**
- Create: `apps/worker/src/handlers/backtest-handler.ts`

- [ ] **Step 1: 创建回测任务处理器**

```typescript
import { TaskType } from '@quant/common';
import type { TaskHandler, TaskRecord } from '../queue.js';
import { BacktestRunner } from '@quant/backtest-engine';
import type { BacktestRunnerConfig } from '@quant/backtest-engine';
import type { DataCenter } from '@quant/data-center';
import type { Strategy } from '@quant/strategy-runtime';
import type { BacktestConfig, BacktestResult } from '@quant/common';

/** 回测任务参数 */
export interface BacktestPayload {
  strategyName: string;
  symbol: string;
  config: BacktestConfig;
}

/** 回测任务结果 */
export interface BacktestTaskResult {
  taskId: string;
  backtestResult: BacktestResult;
}

/** 回测任务处理器 */
export class BacktestHandler implements TaskHandler {
  readonly type = TaskType.Backtest;

  constructor(
    private readonly dataCenter: DataCenter,
    private readonly strategyFactory: (name: string) => Strategy | undefined,
  ) {}

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as BacktestPayload;
    const strategy = this.strategyFactory(payload.strategyName);
    if (!strategy) throw new Error(`策略未找到: ${payload.strategyName}`);

    const bars = await this.dataCenter.providers.market.loadBars(
      payload.symbol,
      payload.config.timeframe,
    );
    if (bars.length === 0) throw new Error(`无行情数据: ${payload.symbol}`);

    const runnerConfig: BacktestRunnerConfig = {
      initialCash: payload.config.initialCash,
      slippage: payload.config.slippage,
    };
    const runner = new BacktestRunner(runnerConfig);
    const result = runner.run(strategy, bars);

    return { taskId: task.id, backtestResult: result } as BacktestTaskResult;
  }
}
```

---

## Task 4: 创建 src/handlers/factor-compute-handler.ts

**Files:**
- Create: `apps/worker/src/handlers/factor-compute-handler.ts`

- [ ] **Step 1: 创建因子计算任务处理器**

```typescript
import { TaskType } from '@quant/common';
import type { TaskHandler, TaskRecord } from '../queue.js';
import type { FactorEngine, FactorComputeRequest } from '@quant/factor-lab';
import type { DataCenter } from '@quant/data-center';

/** 因子计算任务参数 */
export interface FactorComputePayload {
  factorIds: string[];
  symbol: string;
  timeframe: string;
}

/** 因子计算任务处理器 */
export class FactorComputeHandler implements TaskHandler {
  readonly type = TaskType.FactorCompute;

  constructor(
    private readonly dataCenter: DataCenter,
    private readonly factorEngine: FactorEngine,
  ) {}

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as FactorComputePayload;

    const bars = await this.dataCenter.providers.market.loadBars(
      payload.symbol,
      payload.timeframe as '1d' | '1h' | '1m',
    );
    if (bars.length === 0) throw new Error(`无行情数据: ${payload.symbol}`);

    const requests: FactorComputeRequest[] = payload.factorIds.map((factorId) => ({
      factorId, symbol: payload.symbol, bars,
    }));

    const result = this.factorEngine.computeBatch(requests);
    return { taskId: task.id, results: result.results, errors: result.errors };
  }
}
```

---

## Task 5: 创建 src/handlers/factor-eval-handler.ts

**Files:**
- Create: `apps/worker/src/handlers/factor-eval-handler.ts`

- [ ] **Step 1: 创建因子评估任务处理器**

```typescript
import { TaskType } from '@quant/common';
import type { TaskHandler, TaskRecord } from '../queue.js';
import type { FactorEvalScheduler } from '@quant/factor-lab';

/** 因子评估任务参数 */
export interface FactorEvalPayload {
  factorId: string;
  symbol: string;
  evalStart: number;
  evalEnd: number;
}

/** 因子评估任务处理器 */
export class FactorEvalHandler implements TaskHandler {
  readonly type = TaskType.FactorEval;

  constructor(private readonly evalScheduler: FactorEvalScheduler) {}

  async handle(task: TaskRecord): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as FactorEvalPayload;
    const result = await this.evalScheduler.evaluateFactor({
      factorId: payload.factorId,
      symbol: payload.symbol,
      factorValues: [],
      evalStart: payload.evalStart,
      evalEnd: payload.evalEnd,
    });
    return { taskId: task.id, evalResult: result };
  }
}
```

---

## Task 6: 创建 src/worker.ts — Worker 主类

**Files:**
- Create: `apps/worker/src/worker.ts`

- [ ] **Step 1: 创建 Worker 主类**

```typescript
import { TaskQueue } from './queue.js';
import type { TaskHandler } from './queue.js';
import type { DataCenter } from '@quant/data-center';
import type { TaskType } from '@quant/common';

/** Worker 配置 */
export interface WorkerConfig {
  dataCenter: DataCenter;
  handlers: TaskHandler[];
}

/** Worker 主类 */
export class Worker {
  public readonly queue: TaskQueue;
  private readonly dataCenter: DataCenter;

  constructor(config: WorkerConfig) {
    this.queue = new TaskQueue();
    this.dataCenter = config.dataCenter;
    for (const handler of config.handlers) {
      this.queue.registerHandler(handler);
    }
  }

  /** 提交任务 */
  submit(type: TaskType, payload: Record<string, unknown>) {
    return this.queue.submit(type, payload);
  }

  /** 查询任务 */
  getTask(taskId: string) {
    return this.queue.get(taskId);
  }

  /** 列出任务 */
  listTasks(type?: TaskType) {
    return this.queue.list(type);
  }

  /** 处理所有待执行任务 */
  async processAll() {
    return this.queue.processAll();
  }

  /** 关闭 Worker */
  async close() {
    await this.dataCenter.close();
  }
}
```

---

## Task 7: 创建 src/index.ts — 统一导出

**Files:**
- Create: `apps/worker/src/index.ts`

- [ ] **Step 1: 创建统一导出**

```typescript
// queue
export { TaskQueue } from './queue.js';
export type { TaskRecord, TaskHandler } from './queue.js';

// worker
export { Worker } from './worker.js';
export type { WorkerConfig } from './worker.js';

// handlers
export { BacktestHandler } from './handlers/backtest-handler.js';
export type { BacktestPayload, BacktestTaskResult } from './handlers/backtest-handler.js';
export { FactorComputeHandler } from './handlers/factor-compute-handler.js';
export type { FactorComputePayload } from './handlers/factor-compute-handler.js';
export { FactorEvalHandler } from './handlers/factor-eval-handler.js';
export type { FactorEvalPayload } from './handlers/factor-eval-handler.js';
```

---

## Task 8: 编写测试 — tests/queue.test.ts

**Files:**
- Create: `apps/worker/tests/queue.test.ts`

- [ ] **Step 1: 创建队列测试**

```typescript
import { describe, it, expect } from 'vitest';
import { TaskQueue } from '../src/queue.js';
import type { TaskHandler, TaskRecord } from '../src/queue.js';
import { TaskType, TaskStatus } from '@quant/common';

function makeHandler(type: TaskType, result: Record<string, unknown> = {}): TaskHandler {
  return { type, async handle() { return result; } };
}

function makeFailingHandler(type: TaskType): TaskHandler {
  return { type, async handle() { throw new Error('处理失败'); } };
}

describe('TaskQueue', () => {
  it('提交任务', () => {
    const queue = new TaskQueue();
    const task = queue.submit(TaskType.Backtest, { symbol: 'CSI500' });
    expect(task.id).toMatch(/^task-\d+$/);
    expect(task.status).toBe(TaskStatus.Pending);
  });

  it('获取任务', () => {
    const queue = new TaskQueue();
    const task = queue.submit(TaskType.Backtest, {});
    expect(queue.get(task.id)).toBe(task);
    expect(queue.get('nonexistent')).toBeUndefined();
  });

  it('列出任务', () => {
    const queue = new TaskQueue();
    queue.submit(TaskType.Backtest, {});
    queue.submit(TaskType.Backtest, {});
    queue.submit(TaskType.FactorCompute, {});
    expect(queue.list()).toHaveLength(3);
    expect(queue.list(TaskType.Backtest)).toHaveLength(2);
  });

  it('取消 Pending 任务', () => {
    const queue = new TaskQueue();
    const task = queue.submit(TaskType.Backtest, {});
    expect(queue.cancel(task.id)).toBe(true);
    expect(task.status).toBe(TaskStatus.Cancelled);
  });

  it('执行任务', async () => {
    const queue = new TaskQueue();
    queue.registerHandler(makeHandler(TaskType.Backtest, { returnCode: 0 }));
    const task = queue.submit(TaskType.Backtest, { symbol: 'CSI500' });
    const processed = await queue.processNext();
    expect(processed).toBe(task);
    expect(task.status).toBe(TaskStatus.Completed);
    expect(task.result).toEqual({ returnCode: 0 });
  });

  it('任务失败', async () => {
    const queue = new TaskQueue();
    queue.registerHandler(makeFailingHandler(TaskType.Backtest));
    const task = queue.submit(TaskType.Backtest, {});
    await queue.processNext();
    expect(task.status).toBe(TaskStatus.Failed);
    expect(task.error).toBe('Error: 处理失败');
  });

  it('processAll 执行所有待处理任务', async () => {
    const queue = new TaskQueue();
    queue.registerHandler(makeHandler(TaskType.Backtest));
    queue.submit(TaskType.Backtest, {});
    queue.submit(TaskType.Backtest, {});
    const processed = await queue.processAll();
    expect(processed).toHaveLength(2);
    expect(processed.every((t) => t.status === TaskStatus.Completed)).toBe(true);
  });
});
```

---

## Task 9: 编写测试 — tests/backtest-handler.test.ts

**Files:**
- Create: `apps/worker/tests/backtest-handler.test.ts`

- [ ] **Step 1: 创建回测处理器测试**

```typescript
import { describe, it, expect } from 'vitest';
import { BacktestHandler } from '../src/handlers/backtest-handler.js';
import { TaskQueue } from '../src/queue.js';
import { TaskType, TaskStatus, TimeFrame } from '@quant/common';
import { createDataCenter } from '@quant/data-center';
import type { Strategy } from '@quant/strategy-runtime';
import { DualMAStrategy } from '@quant/strategies';

describe('BacktestHandler', () => {
  it('执行回测任务', async () => {
    const dc = await createDataCenter({ dbPath: ':memory:' });
    const bars = Array.from({ length: 100 }, (_, i) => ({
      symbol: 'TEST', timeframe: TimeFrame.D1,
      timestamp: 1700000000000 + i * 86400000,
      open: 100 + Math.sin(i * 0.1) * 10,
      high: 105 + Math.sin(i * 0.1) * 10,
      low: 95 + Math.sin(i * 0.1) * 10,
      close: 102 + Math.sin(i * 0.1) * 10,
      volume: 1000000,
      turnover: 102000000,
    }));
    await dc.repos.bars.save(bars);

    const strategyFactory = (name: string): Strategy | undefined => {
      if (name === 'dual-ma') return new DualMAStrategy({ fastPeriod: 5, slowPeriod: 20 });
      return undefined;
    };

    const handler = new BacktestHandler(dc, strategyFactory);
    const queue = new TaskQueue();
    queue.registerHandler(handler);

    const task = queue.submit(TaskType.Backtest, {
      strategyName: 'dual-ma',
      symbol: 'TEST',
      config: {
        symbol: 'TEST', timeframe: TimeFrame.D1,
        initialCash: 1000000, slippage: 0.001,
        start: 1700000000000, end: 1700864000000,
      },
    });

    await queue.processAll();
    expect(task.status).toBe(TaskStatus.Completed);
    expect(task.result).toBeDefined();
    expect(task.result!.backtestResult).toBeDefined();

    await dc.close();
  }, 30000);
});
```

---

## Task 10: 编写测试 — tests/worker.test.ts

**Files:**
- Create: `apps/worker/tests/worker.test.ts`

- [ ] **Step 1: 创建 Worker 主类测试**

```typescript
import { describe, it, expect } from 'vitest';
import { Worker } from '../src/worker.js';
import { TaskType, TaskStatus } from '@quant/common';
import type { TaskHandler, TaskRecord } from '../src/queue.js';
import { createDataCenter } from '@quant/data-center';

function makeSimpleHandler(type: TaskType): TaskHandler {
  return { type, async handle(task: TaskRecord) { return { processed: true, taskId: task.id }; } };
}

describe('Worker', () => {
  it('提交和处理任务', async () => {
    const dc = await createDataCenter({ dbPath: ':memory:' });
    const worker = new Worker({ dataCenter: dc, handlers: [makeSimpleHandler(TaskType.Backtest)] });
    const task = worker.submit(TaskType.Backtest, { symbol: 'TEST' });
    expect(task.status).toBe(TaskStatus.Pending);
    await worker.processAll();
    expect(task.status).toBe(TaskStatus.Completed);
    expect(worker.getTask(task.id)).toBeDefined();
    await worker.close();
  });

  it('列出任务', async () => {
    const dc = await createDataCenter({ dbPath: ':memory:' });
    const worker = new Worker({ dataCenter: dc, handlers: [makeSimpleHandler(TaskType.Backtest)] });
    worker.submit(TaskType.Backtest, { symbol: 'A' });
    worker.submit(TaskType.Backtest, { symbol: 'B' });
    expect(worker.listTasks()).toHaveLength(2);
    await worker.close();
  });
});
```

---

## Task 11: 运行测试验证

- [ ] **Step 1: 运行测试**

Run: `pnpm --filter @quant/worker test`
Expected: 全部通过

- [ ] **Step 2: 运行构建**

Run: `pnpm --filter @quant/worker build`
Expected: 编译通过

- [ ] **Step 3: 运行全量测试确认无回归**

Run: `pnpm test`
Expected: 全部通过

---

## Task 12: Commit

- [ ] **Step 1: 提交**

```bash
git add apps/worker/
git commit -m "feat(worker): add async task queue with backtest and factor handlers"
```
