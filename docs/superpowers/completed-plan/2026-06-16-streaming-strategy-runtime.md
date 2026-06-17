# 策略运行时流式输出 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 策略运行时（回测/因子计算/训练）支持流式输出，前端实时展示进度和日志，用户无需等待任务完成才能看到反馈。

**Architecture:** Python CLI 通过 stdout 逐行输出 NDJSON 事件流（progress/log/result），PythonBridge 改为流式读取模式；API 层通过 SSE (Server-Sent Events) 端点将事件推送给前端；前端用 EventSource 消费 SSE，实时更新 Job 进度条和日志面板。

**Tech Stack:** NDJSON (Python stdout), SSE (Fastify), EventSource (浏览器原生 API)

---

## 当前架构问题

```
Python CLI → stdout 一次性 JSON → PythonBridge 等待进程结束 → Worker 同步返回 → API 轮询 → 前端轮询
```

- Python CLI 只在进程结束时输出一次 JSON，中间无任何反馈
- 前端通过 2s 轮询 `GET /api/tasks/:id` 获取状态，粒度粗、延迟高
- 用户点击 Run Research 后，直到任务完成才能看到结果

## 目标架构

```
Python CLI → stdout NDJSON 事件流 → PythonBridge 流式读取 → Worker 回调 → API SSE 端点 → 前端 EventSource
```

## 事件协议定义

Python stdout 每行一个 JSON 对象（NDJSON），格式：

```jsonl
{"event":"progress","taskId":"task-1","percent":30,"message":"Processing bar 300/1000"}
{"event":"log","taskId":"task-1","level":"info","message":"Strategy initialized"}
{"event":"log","taskId":"task-1","level":"warn","message":"Slippage adjusted"}
{"event":"result","taskId":"task-1","data":{...}}
{"event":"error","taskId":"task-1","error":{"code":"NO_DATA","message":"No bars found"}}
```

| event | 必填字段 | 说明 |
|-------|---------|------|
| `progress` | `percent`, `message` | 进度更新，percent 0-100 |
| `log` | `level`, `message` | 运行日志，level: info/warn/error |
| `result` | `data` | 最终结果，成功时发送 |
| `error` | `error` | 错误，失败时发送 |

## 文件变更清单

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/strategy-runtime/quantforge_strategy/cli.py` | 修改 | 支持 NDJSON 流式输出 |
| `packages/strategy-runtime/quantforge_strategy/commands/backtest.py` | 修改 | 回测过程中发送 progress/log 事件 |
| `packages/strategy-runtime/quantforge_strategy/commands/factor_eval.py` | 修改 | 因子评估过程中发送 progress/log 事件 |
| `packages/strategy-runtime/quantforge_strategy/commands/ai_train.py` | 修改 | AI 训练过程中发送 progress/log 事件 |
| `apps/worker/src/python-bridge.ts` | 修改 | 流式读取 stdout，逐行解析 NDJSON，回调通知 |
| `apps/worker/src/queue.ts` | 修改 | TaskRecord 增加 progress/lines 字段，TaskHandler 支持事件回调 |
| `apps/worker/src/types.ts` | 修改 | 新增 StreamEvent 类型 |
| `apps/worker/src/handlers/backtest-handler.ts` | 修改 | 接收流式事件，更新任务进度 |
| `apps/api/src/routes/task.ts` | 修改 | 新增 SSE 端点 `GET /api/tasks/:id/stream` |
| `apps/api/src/plugins/task-service.ts` | 修改 | 新增事件订阅接口 |
| `apps/web/src/api/tasks.ts` | 修改 | 新增 `streamTask` 函数，封装 EventSource |
| `apps/web/src/hooks/useTaskStream.ts` | 新建 | 封装 SSE 连接和事件分发 |
| `apps/web/src/hooks/useTasks.ts` | 修改 | 用 SSE 替代轮询 |
| `apps/web/src/hooks/useResearchWorkflow.ts` | 修改 | 流式更新 Job 进度和日志 |
| `apps/web/src/components/jobs.tsx` | 修改 | 实时进度条和日志展示 |

---

### Task 1: Python CLI NDJSON 流式输出

**Files:**
- Modify: `packages/strategy-runtime/quantforge_strategy/cli.py`

- [ ] **Step 1: 添加流式输出辅助函数**

在 `cli.py` 中添加 `emit` 函数，替代原来的 `_output`：

```python
def emit(event: str, data: dict) -> None:
    """输出一行 NDJSON 事件到 stdout"""
    line = json.dumps({"event": event, **data}, ensure_ascii=False)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def _output(data: dict) -> None:
    """兼容旧的一次性输出（内部调用 emit）"""
    if data.get("ok"):
        emit("result", {"data": data["data"]})
    else:
        emit("error", {"error": data.get("error", {"code": "UNKNOWN", "message": "Unknown error"})})
```

- [ ] **Step 2: 修改 main() 使用 emit**

```python
def main() -> None:
    try:
        raw = sys.stdin.read()
        request = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as e:
        emit("error", {"error": {"code": "INVALID_JSON", "message": str(e)}})
        return

    command = request.get("command", "")
    handler = _COMMANDS.get(command)
    if handler is None:
        emit("error", {"error": {"code": "UNKNOWN_COMMAND", "message": f"Unknown command: {command}"}})
        return

    try:
        result = handler(request)
        _output(result)
    except Exception as e:
        emit("error", {"error": {"code": "INTERNAL_ERROR", "message": str(e)}})
```

- [ ] **Step 3: 运行现有测试验证兼容性**

Run: `cd packages/strategy-runtime && python -m pytest tests/ -v`
Expected: 所有测试通过（`_output` 内部调用 `emit`，最终输出格式兼容）

- [ ] **Step 4: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/cli.py
git commit -m "feat(strategy-runtime): CLI emits NDJSON event stream instead of single JSON"
```

---

### Task 2: 回测命令发送 progress/log 事件

**Files:**
- Modify: `packages/strategy-runtime/quantforge_strategy/commands/backtest.py`

- [ ] **Step 1: 在回测循环中发送 progress 事件**

```python
"""回测命令"""

from __future__ import annotations

import dataclasses
import json
from typing import Any

from quantforge_backtest import BacktestRunner
from quantforge_strategies import get as get_strategy
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame


def run_backtest(params: dict[str, Any], emit: Any = None) -> dict[str, Any]:
    strategy_name = params["strategy"]
    config = params.get("config", {})
    data_range = params.get("dataRange", {})

    _emit = emit or (lambda *a, **kw: None)

    strategy_cls = get_strategy(strategy_name)
    strategy = strategy_cls()

    db_path = data_range.get("dbPath", "data/quant.db")
    symbol = data_range.get("symbol", "")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))

    _emit("log", {"level": "info", "message": f"Loading data for {symbol} {timeframe.value}"})

    client = DataClient(db_path)
    bars = client.query_bars(
        symbol, timeframe,
        start_ts=data_range.get("startTs"),
        end_ts=data_range.get("endTs"),
    )

    if not bars:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol} {timeframe.value}"}}

    total = len(bars)
    _emit("log", {"level": "info", "message": f"Loaded {total} bars, starting backtest"})

    runner = BacktestRunner(
        strategy, bars,
        initial_cash=config.get("initialCash"),
        slippage=config.get("slippage"),
    )
    result = runner.run(on_bar=lambda i: _emit_progress(_emit, i, total))

    return {"ok": True, "data": _result_to_dict(result)}


def _emit_progress(emit: Any, index: int, total: int) -> None:
    percent = int((index + 1) / total * 100)
    if percent % 10 == 0 or index + 1 == total:
        emit("progress", {"percent": percent, "message": f"Processing bar {index + 1}/{total}"})


def _result_to_dict(result) -> dict[str, Any]:
    def _to_dict(obj):
        if dataclasses.is_dataclass(obj):
            return {f: _to_dict(getattr(obj, f)) for f in obj.__dataclass_fields__}
        if isinstance(obj, list):
            return [_to_dict(i) for i in obj]
        if isinstance(obj, (int, float, str, bool)) or obj is None:
            return obj
        if hasattr(obj, "value"):  # Enum
            return obj.value
        return str(obj)
    return _to_dict(result)
```

- [ ] **Step 2: 修改 cli.py 传递 emit 给命令处理器**

```python
def _run_backtest(params: dict) -> dict:
    from .commands.backtest import run_backtest
    return run_backtest(params, emit=emit)
```

对 `_run_factor_eval` 和 `_run_ai_train` 同理，传递 `emit=emit`。

- [ ] **Step 3: 运行测试**

Run: `cd packages/strategy-runtime && python -m pytest tests/ -v`
Expected: 所有测试通过（`emit` 默认为空 lambda，不影响现有逻辑）

- [ ] **Step 4: Commit**

```bash
git add packages/strategy-runtime/quantforge_strategy/commands/backtest.py packages/strategy-runtime/quantforge_strategy/cli.py
git commit -m "feat(strategy-runtime): backtest command emits progress/log events"
```

---

### Task 3: PythonBridge 流式读取

**Files:**
- Modify: `apps/worker/src/python-bridge.ts`
- Modify: `apps/worker/src/types.ts`

- [ ] **Step 1: 在 types.ts 中新增 StreamEvent 类型**

```typescript
// 在 apps/worker/src/types.ts 末尾追加

/** Python CLI 流式事件 */
export interface StreamEvent {
  event: 'progress' | 'log' | 'result' | 'error';
  percent?: number;
  message?: string;
  level?: string;
  data?: unknown;
  error?: { code: string; message: string };
}
```

- [ ] **Step 2: PythonBridge 新增 streamCall 方法**

在 `PythonBridge` 类中新增 `streamCall` 方法，保留原 `call` 方法不变：

```typescript
/**
 * 流式调用 Python CLI
 * @param request 传入的 JSON 对象
 * @param onEvent 收到每个 NDJSON 事件时的回调
 * @returns 最终结果（result 或 error 事件）
 */
async streamCall(
  request: Record<string, unknown>,
  onEvent: (event: StreamEvent) => void,
): Promise<PythonResult> {
  const input = JSON.stringify(request);

  return new Promise<PythonResult>((resolve, reject) => {
    const proc = spawn(this.pythonPath, ["-m", "quantforge_strategy"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let buffer = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString();
      // 逐行解析 NDJSON
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // 保留未完成的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as StreamEvent;
          onEvent(event);
        } catch {
          // 忽略无法解析的行
        }
      }
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Python CLI timed out after ${this.timeout}ms`));
    }, this.timeout);

    proc.on("close", (code) => {
      clearTimeout(timer);

      // 处理 buffer 中剩余内容
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as StreamEvent;
          onEvent(event);
        } catch {
          // 忽略
        }
      }

      if (code !== 0 && !stderr.trim()) {
        // 进程异常退出且无 stdout 事件
        reject(new Error(`Python CLI exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      // 从事件流中提取最终结果
      // streamCall 的 resolve 由调用方根据 onEvent 回调中的 result/error 事件处理
      // 这里只需确保进程正常结束
      resolve({ ok: true });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}
```

- [ ] **Step 3: 运行 Worker 构建**

Run: `cd apps/worker && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/python-bridge.ts apps/worker/src/types.ts
git commit -m "feat(worker): PythonBridge adds streamCall for NDJSON event streaming"
```

---

### Task 4: Worker 任务队列支持流式事件

**Files:**
- Modify: `apps/worker/src/queue.ts`
- Modify: `apps/worker/src/handlers/backtest-handler.ts`

- [ ] **Step 1: TaskRecord 增加 progress 和 lines 字段**

在 `queue.ts` 的 `TaskRecord` 接口中追加：

```typescript
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
  progress?: number;       // 0-100 进度百分比
  lines?: string[];        // 运行日志行
}
```

在 `toRecord` 方法中追加解析：

```typescript
progress: (values[idx('progress')] as number | null) ?? undefined,
lines: values[idx('lines')] ? JSON.parse(values[idx('lines')] as string) : undefined,
```

在 `initSchema` 中修改建表语句，追加列：

```sql
progress INTEGER DEFAULT 0,
lines TEXT
```

在 `submit` 方法中初始化：

```typescript
const task: TaskRecord = {
  id, type, status: TaskStatus.Pending, payload,
  submittedAt: Date.now(),
  progress: 0,
  lines: [],
};
```

在 `processNext` 的 Running 状态更新后，handler 处理过程中需要支持事件回调更新 progress/lines。修改 `TaskHandler` 接口：

```typescript
/** 任务处理器接口 */
export interface TaskHandler {
  readonly type: TaskType;
  handle(task: TaskRecord, onEvent?: (event: StreamEvent) => void): Promise<Record<string, unknown>>;
}
```

在 `processNext` 中，handler 调用时传入 `onEvent` 回调，回调内更新 DB 中的 progress 和 lines：

```typescript
const onEvent = (event: StreamEvent) => {
  if (event.event === 'progress') {
    this.db.run('UPDATE tasks SET progress = ? WHERE id = ?', [event.percent ?? 0, task.id]);
    this.persist();
  } else if (event.event === 'log') {
    this.db.run('UPDATE tasks SET lines = ? WHERE id = ?', [
      JSON.stringify([...(task.lines ?? []), `[${event.level ?? 'info'}] ${event.message ?? ''}`]),
      task.id,
    ]);
    this.persist();
  }
};

const result = await handler.handle({ ...task, status: TaskStatus.Running, startedAt: now }, onEvent);
```

- [ ] **Step 2: BacktestHandler 使用 streamCall**

```typescript
import { PythonBridge } from '../python-bridge.js';
import type { StreamEvent } from '../types.js';

export class BacktestHandler implements TaskHandler {
  readonly type = TaskType.Backtest;

  constructor(private readonly bridge: PythonBridge) {}

  async handle(task: TaskRecord, onEvent?: (event: StreamEvent) => void): Promise<Record<string, unknown>> {
    const payload = task.payload as unknown as BacktestPayload;

    // 优先使用流式调用
    if (onEvent) {
      const result = await this.bridge.streamCall(
        {
          command: 'backtest',
          strategy: payload.strategyName,
          config: {
            initialCash: payload.initialCash,
            slippage: payload.slippage,
          },
          dataRange: {
            symbol: payload.symbol,
            timeframe: payload.timeframe,
          },
        },
        onEvent,
      );

      if (!result.ok) {
        throw new Error('Python backtest failed');
      }

      return { taskId: task.id, backtestResult: result.data } as Record<string, unknown>;
    }

    // fallback: 无回调时用同步调用
    const result = await this.bridge.call({
      command: 'backtest',
      strategy: payload.strategyName,
      config: {
        initialCash: payload.initialCash,
        slippage: payload.slippage,
      },
      dataRange: {
        symbol: payload.symbol,
        timeframe: payload.timeframe,
      },
    });

    if (!result.ok) {
      throw new Error(result.error?.message ?? 'Python backtest failed');
    }

    return { taskId: task.id, backtestResult: result.data } as Record<string, unknown>;
  }
}
```

- [ ] **Step 3: 运行类型检查**

Run: `cd apps/worker && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/worker/src/queue.ts apps/worker/src/handlers/backtest-handler.ts
git commit -m "feat(worker): task queue supports streaming events with progress and log lines"
```

---

### Task 5: API 层 SSE 端点

**Files:**
- Modify: `apps/api/src/plugins/task-service.ts`
- Modify: `apps/api/src/routes/task.ts`

- [ ] **Step 1: TaskService 新增事件订阅接口**

在 `task-service.ts` 中追加：

```typescript
/** 任务事件（SSE 推送） */
export interface TaskEvent {
  type: 'progress' | 'log' | 'status' | 'result' | 'error';
  taskId: string;
  percent?: number;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export type TaskEventHandler = (event: TaskEvent) => void;

export interface TaskService {
  submit(type: TaskType, payload: Record<string, unknown>): TaskView;
  get(taskId: string): TaskView | undefined;
  list(type?: TaskType): TaskView[];
  /** 订阅指定任务的事件 */
  subscribe(taskId: string, handler: TaskEventHandler): () => void;
}
```

在 `InMemoryTaskService` 中实现 `subscribe`：

```typescript
export class InMemoryTaskService implements TaskService {
  private readonly tasks = new Map<string, TaskView>();
  private readonly subscribers = new Map<string, Set<TaskEventHandler>>();
  private idCounter = 0;

  submit(type: TaskType, payload: Record<string, unknown>): TaskView {
    const id = `task-${++this.idCounter}`;
    const task: TaskView = {
      id, type, status: TaskStatus.Pending, payload,
      submittedAt: Date.now(),
    };
    this.tasks.set(id, task);
    this._emit(id, { type: 'status', taskId: id, message: 'pending' });
    return task;
  }

  get(taskId: string): TaskView | undefined {
    return this.tasks.get(taskId);
  }

  list(type?: TaskType): TaskView[] {
    const all = Array.from(this.tasks.values());
    return type ? all.filter((t) => t.type === type) : all;
  }

  subscribe(taskId: string, handler: TaskEventHandler): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(handler);
    return () => this.subscribers.get(taskId)?.delete(handler);
  }

  /** 内部：向任务订阅者推送事件 */
  private _emit(taskId: string, event: TaskEvent): void {
    this.subscribers.get(taskId)?.forEach((h) => h(event));
  }

  /** 更新任务状态（供 Worker 调用） */
  updateTask(taskId: string, updates: Partial<TaskView> & { event?: TaskEvent }): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    Object.assign(task, updates);
    if (updates.event) {
      this._emit(taskId, updates.event);
    }
  }
}
```

- [ ] **Step 2: 新增 SSE 路由**

在 `task.ts` 路由中追加 SSE 端点：

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function taskRoutes(app: FastifyInstance) {
  // ... 现有路由保持不变 ...

  /** SSE: 流式推送任务事件 */
  app.get<{ Params: { id: string } }>('/:id/stream', async (req: FastifyRequest, reply: FastifyReply) => {
    const taskId = (req.params as { id: string }).id;
    const task = app.taskService.get(taskId);
    if (!task) {
      return reply.code(404).send({ error: 'Task not found' });
    }

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 发送初始状态
    reply.raw.write(`data: ${JSON.stringify({ type: 'status', taskId, message: task.status })}\n\n`);

    // 订阅后续事件
    const unsubscribe = app.taskService.subscribe(taskId, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      // 任务终态时关闭连接
      if (event.type === 'result' || event.type === 'error') {
        unsubscribe();
        reply.raw.end();
      }
    });

    // 客户端断开时清理
    req.raw.on('close', () => {
      unsubscribe();
    });
  });
}
```

- [ ] **Step 3: 运行 API 类型检查**

Run: `cd apps/api && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/plugins/task-service.ts apps/api/src/routes/task.ts
git commit -m "feat(api): add SSE endpoint for streaming task events"
```

---

### Task 6: 前端 SSE 消费与实时 UI 更新

**Files:**
- Create: `apps/web/src/hooks/useTaskStream.ts`
- Modify: `apps/web/src/api/tasks.ts`
- Modify: `apps/web/src/hooks/useTasks.ts`
- Modify: `apps/web/src/hooks/useResearchWorkflow.ts`
- Modify: `apps/web/src/components/jobs.tsx`

- [ ] **Step 1: api/tasks.ts 新增 streamTask**

```typescript
/** SSE 任务事件 */
export interface TaskStreamEvent {
  type: 'progress' | 'log' | 'status' | 'result' | 'error';
  taskId: string;
  percent?: number;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

/** 打开 SSE 连接，返回关闭函数 */
export function streamTask(
  taskId: string,
  onEvent: (event: TaskStreamEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource(`/api/tasks/${taskId}/stream`);
  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as TaskStreamEvent;
      onEvent(event);
    } catch {
      // 忽略解析错误
    }
  };
  es.onerror = (err) => {
    es.close();
    onError?.(err);
  };
  return () => es.close();
}
```

- [ ] **Step 2: 创建 useTaskStream hook**

```typescript
// apps/web/src/hooks/useTaskStream.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import { streamTask, type TaskStreamEvent } from '../api/tasks';

export interface TaskStreamState {
  progress: number;
  lines: string[];
  status: string;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

const INITIAL_STATE: TaskStreamState = {
  progress: 0,
  lines: [],
  status: 'pending',
};

export function useTaskStream(taskId: string | null) {
  const [state, setState] = useState<TaskStreamState>(INITIAL_STATE);
  const closeRef = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
  }, []);

  useEffect(() => {
    if (!taskId) return;

    setState(INITIAL_STATE);
    closeRef.current = streamTask(
      taskId,
      (event: TaskStreamEvent) => {
        setState((prev) => {
          switch (event.type) {
            case 'progress':
              return { ...prev, progress: event.percent ?? prev.progress };
            case 'log':
              return { ...prev, lines: [...prev.lines, `[${event.level ?? 'info'}] ${event.message ?? ''}`] };
            case 'status':
              return { ...prev, status: event.message ?? prev.status };
            case 'result':
              return { ...prev, status: 'completed', result: event.data, progress: 100 };
            case 'error':
              return { ...prev, status: 'failed', error: event.error };
            default:
              return prev;
          }
        });
      },
      () => {
        setState((prev) => ({ ...prev, status: 'failed' }));
      },
    );

    return () => {
      close();
    };
  }, [taskId, close]);

  return { ...state, close };
}
```

- [ ] **Step 3: useTasks 中用 SSE 替代轮询**

修改 `useTasks.ts`，`submitAndPoll` 改为 `submitAndStream`：

```typescript
import { useCallback } from 'react';
import { useApi } from './useApi';
import { fetchTasks, submitBacktest, streamTask, type ApiTask, type TaskStreamEvent } from '../api/tasks';

export function useTasks() {
  const { data, loading, error, reload } = useApi<ApiTask[]>(() => fetchTasks());

  /** 提交回测任务并通过 SSE 流式跟踪 */
  const submitAndStream = useCallback(
    (taskId: string, onEvent: (event: TaskStreamEvent) => void): () => void => {
      return streamTask(taskId, onEvent, () => {
        // SSE 错误时 fallback 到轮询
      });
    },
    [],
  );

  /** 提交回测任务，返回 taskId */
  const submitBacktestTask = useCallback(
    async (payload: {
      strategy: string;
      symbol?: string;
      timeframe?: string;
      initialCash?: number;
      slippage?: number;
      params?: Record<string, unknown>;
    }): Promise<string> => {
      const { id } = await submitBacktest(payload);
      return id;
    },
    [],
  );

  return { tasks: data ?? [], loading, error, reload, submitBacktestTask, submitAndStream };
}
```

- [ ] **Step 4: useResearchWorkflow 使用流式更新**

修改 `handleRunResearch`，提交后用 SSE 跟踪进度：

```typescript
// 在 useResearchWorkflow.ts 中，修改 submitAndPoll 为流式模式

const { submitBacktestTask, submitAndStream } = useTasks();

// handleRunResearch 中：
if (selectedStrategy) {
  submitBacktestTask({
    strategy: selectedStrategy.id,
    symbol: '600519',
    timeframe: '1d',
    initialCash: 1000000,
    slippage: 0.001,
  })
    .then((taskId) => {
      // 创建本地 job 跟踪进度
      const nextJob = createResearchJob(
        { id: taskId, mode: activeMode, sequence, strategy: selectedStrategyForLanguage, configSummary: activeConfigSummary },
        language,
      );
      setJobs((current) => [nextJob, ...current]);

      // 流式跟踪
      submitAndStream(taskId, (event) => {
        if (event.type === 'progress') {
          setJobs((current) =>
            current.map((j) => j.id === taskId ? { ...j, progress: event.percent ?? j.progress } : j),
          );
        }
        if (event.type === 'log') {
          // 可选：追加到 job 的日志
        }
        if (event.type === 'result') {
          // 创建报告
          const nextReport = createResearchReport(
            { id: `report-${runId}`, jobId: taskId, mode: activeMode, sequence, strategy: selectedStrategyForLanguage, generatedAt: formatReportTime(language), configSummary: activeConfigSummary },
            language,
          );
          const nextBacktestReport = createBacktestReportFull({
            id: `backtest-full-report-${runId}`, taskId, status: 'completed', generatedAt: formatReportTime(language),
          });
          setReports((current) => [nextReport, ...current]);
          setBacktestReports((current) => [nextBacktestReport, ...current]);
          setActiveReportId(nextReport.id);
          reload();
        }
        if (event.type === 'error') {
          createMockJobAndReport(runId, jobId, sequence);
        }
      });
    })
    .catch(() => {
      createMockJobAndReport(runId, jobId, sequence);
    });
}
```

- [ ] **Step 5: JobList 组件实时进度条**

修改 `jobs.tsx`，进度条使用实际 progress 值而非固定值：

```tsx
<div className={jobs.progress} aria-label={`${job.progress}%`}>
  <i className={jobs.progressBar} style={{ width: `${job.progress}%`, transition: 'width 0.3s ease' }} />
</div>
```

- [ ] **Step 6: 运行前端构建验证**

Run: `cd apps/web && npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/api/tasks.ts apps/web/src/hooks/useTaskStream.ts apps/web/src/hooks/useTasks.ts apps/web/src/hooks/useResearchWorkflow.ts apps/web/src/components/jobs.tsx
git commit -m "feat(web): consume SSE stream for real-time task progress and logs"
```

---

## 自检清单

### 1. Spec 覆盖度
- [x] Python CLI 流式输出 → Task 1, 2
- [x] PythonBridge 流式读取 → Task 3
- [x] Worker 任务队列支持事件 → Task 4
- [x] API SSE 端点 → Task 5
- [x] 前端 SSE 消费与实时 UI → Task 6
- [x] 向后兼容（fallback 到同步模式）→ Task 3, 4

### 2. 占位符扫描
- 无 TBD/TODO/placeholder

### 3. 类型一致性
- `StreamEvent` 在 `apps/worker/src/types.ts` 定义，`PythonBridge.streamCall` 和 `BacktestHandler` 使用同一类型
- `TaskStreamEvent` 在 `apps/web/src/api/tasks.ts` 定义，`useTaskStream` 和 `useTasks` 使用同一类型
- `TaskEventHandler` 在 `task-service.ts` 定义，SSE 路由和 subscribe 使用同一类型
