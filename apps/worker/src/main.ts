/**
 * Worker 独立入口 — 通过 HTTP 与 API 通信，轮询 pending 任务并处理
 *
 * 用法: tsx src/main.ts
 * 环境变量:
 *   API_BASE_URL - API 地址，默认 http://127.0.0.1:3002
 *   POLL_INTERVAL_MS - 轮询间隔，默认 1000
 */

import { BacktestHandler } from './handlers/backtest-handler.js';
import { CollectHandler } from './handlers/collect-handler.js';
import { DiagnosticsHandler } from './handlers/diagnostics-handler.js';
import { PythonBridge } from './python-bridge.js';
import { GitCollector } from './git-collector.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { TaskStatus, type StreamEvent } from './types.js';
import type { TaskRecord, TaskHandler } from './types.js';

/** 根据任务类型创建对应的 handler */
function createHandler(taskType: string): TaskHandler | null {
  switch (taskType) {
    case 'backtest': {
      const bridge = new PythonBridge({ timeout: 120_000 });
      return new BacktestHandler(bridge);
    }
    case 'collect': {
      return new CollectHandler();
    }
    case 'diagnostics': {
      const bridge = new PythonBridge({ timeout: 120_000 });
      return new DiagnosticsHandler(bridge);
    }
    default:
      return null;
  }
}

const API_BASE = process.env.API_BASE_URL ?? 'http://127.0.0.1:3002';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL_MS ?? '1000', 10);
const GIT_SCAN_INTERVAL = parseInt(process.env.GIT_SCAN_INTERVAL_MS ?? '30000', 10);
const execFileAsync = promisify(execFile);

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

async function getGitHead(): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: process.cwd() });
    const head = stdout.trim();
    return head || undefined;
  } catch (error) {
    console.warn(
      '[worker] Failed to read Git HEAD:',
      error instanceof Error ? error.message : error
    );
    return undefined;
  }
}

async function getResearchCursor(source: string): Promise<string | undefined> {
  const response = await fetch(
    `${API_BASE}/api/internal/research/collectors/${encodeURIComponent(source)}`
  );
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`读取研究采集游标失败: ${response.status}`);
  const state = (await response.json()) as { lastValue?: string };
  return state.lastValue;
}

async function scanGit(): Promise<void> {
  const collector = new GitCollector({
    cwd: process.cwd(),
    api: {
      getCursor: getResearchCursor,
      saveCursor: async (source, lastValue) => {
        await apiPost(`/api/internal/research/collectors/${encodeURIComponent(source)}`, {
          lastValue,
        });
      },
      ingestEvent: async (event) => {
        await apiPost('/api/internal/research/events', event);
      },
    },
  });
  const result = await collector.scan();
  if (result.collected > 0) {
    console.log(`[worker] Collected ${result.collected} Git commits`);
  }
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
  const handler = createHandler(task.type);
  if (!handler) {
    await apiPost(`/api/internal/tasks/${taskId}/fail`, {
      error: `Unsupported task type: ${task.type}`,
    });
    return;
  }

  // 3. 构造 TaskRecord
  const taskRecord: TaskRecord = {
    id: taskId,
    type: task.type as never,
    status: TaskStatus.Running,
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
      } else if (event.event === 'research' && event.data && typeof event.data === 'object') {
        const researchEvent = event.data as {
          eventType?: string;
          dedupeKey?: string;
          payload?: Record<string, unknown>;
          occurredAt?: number;
        };
        if (!researchEvent.eventType || !researchEvent.dedupeKey || !researchEvent.payload) {
          throw new Error('Invalid research event emitted by task handler');
        }
        const gitHead = await getGitHead();
        await apiPost('/api/internal/research/events', {
          ...researchEvent,
          payload: { ...researchEvent.payload, gitHead },
        });
      }
    } catch (err) {
      console.error(`[worker] Failed to forward event for ${taskId}:`, err);
      if (event.event === 'research') throw err;
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
  await scanGit().catch((error) => {
    console.error('[worker] Git scan failed:', error instanceof Error ? error.message : error);
  });

  // 定时轮询
  setInterval(() => {
    void pollOnce();
  }, POLL_INTERVAL);
  setInterval(() => {
    void scanGit().catch((error) => {
      console.error('[worker] Git scan failed:', error instanceof Error ? error.message : error);
    });
  }, GIT_SCAN_INTERVAL);
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
