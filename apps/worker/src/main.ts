/**
 * Worker 独立入口 — 通过 HTTP 与 API 通信，轮询 pending 任务并处理
 *
 * 用法: tsx src/main.ts
 * 环境变量:
 *   API_BASE_URL - API 地址，默认 http://127.0.0.1:3000
 *   POLL_INTERVAL_MS - 轮询间隔，默认 1000
 */

import { BacktestHandler } from './handlers/backtest-handler.js';
import { PythonBridge } from './python-bridge.js';
import type { StreamEvent } from './types.js';
import type { TaskRecord } from './queue.js';

const API_BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:3000';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? '1000', 10);

/** API 返回的任务视图 */
interface ApiTaskView {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
}

/** HTTP 工具函数 */
async function apiGet(path: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

/** 处理单个任务 */
async function processTask(task: ApiTaskView): Promise<void> {
  const taskId = task.id;
  console.log(`[worker] Processing task ${taskId} (type=${task.type})`);

  // 1. 认领任务
  try {
    await apiPost(`/api/internal/tasks/${taskId}/claim`);
  } catch (err) {
    console.log(`[worker] Task ${taskId} claim failed: ${err}`);
    return;
  }

  // 2. 根据任务类型选择 handler
  if (task.type !== 'backtest') {
    await apiPost(`/api/internal/tasks/${taskId}/fail`, {
      error: `Unsupported task type: ${task.type}`,
    });
    return;
  }

  // 3. 执行回测
  const bridge = new PythonBridge({ timeout: 120_000 });
  const handler = new BacktestHandler(bridge);

  // 构造 TaskRecord（BacktestHandler 需要的格式）
  const taskRecord: TaskRecord = {
    id: taskId,
    type: task.type as never,
    status: 'running',
    payload: task.payload,
    submittedAt: Date.now(),
    startedAt: Date.now(),
  };

  // 事件回调：转发到 API
  const onEvent = async (event: StreamEvent) => {
    try {
      if (event.event === 'progress') {
        await apiPost(`/api/internal/tasks/${taskId}/event`, {
          type: 'progress',
          percent: event.percent,
          message: event.message,
        });
      } else if (event.event === 'log') {
        await apiPost(`/api/internal/tasks/${taskId}/event`, {
          type: 'log',
          level: event.level,
          message: event.message,
        });
      }
    } catch (err) {
      console.error(`[worker] Failed to forward event for ${taskId}:`, err);
    }
  };

  try {
    const result = await handler.handle(taskRecord, onEvent as never);
    await apiPost(`/api/internal/tasks/${taskId}/complete`, { result });
    console.log(`[worker] Task ${taskId} completed`);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await apiPost(`/api/internal/tasks/${taskId}/fail`, { error: errorMsg });
    console.error(`[worker] Task ${taskId} failed:`, errorMsg);
  }
}

/** 轮询循环 */
async function pollOnce(): Promise<void> {
  try {
    const pending = (await apiGet('/api/internal/tasks/pending')) as ApiTaskView[];
    if (pending.length === 0) return;

    // 串行处理（避免并发回测冲突）
    for (const task of pending) {
      await processTask(task);
    }
  } catch (err) {
    console.error('[worker] Poll error:', err instanceof Error ? err.message : err);
  }
}

async function main(): Promise<void> {
  console.log(`[worker] Started, polling ${API_BASE} every ${POLL_INTERVAL}ms`);

  // 立即执行一次
  await pollOnce();

  // 定时轮询
  setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL);
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
