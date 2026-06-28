import { TaskStatus, TaskType, type StreamEvent } from './types.js';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

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
  progress?: number;
  lines?: string[];
}

/** 任务事件回调 */
export type TaskEventHandler = (event: StreamEvent) => void;

/** 任务处理器接口 */
export interface TaskHandler {
  readonly type: TaskType;
  handle(task: TaskRecord, onEvent?: TaskEventHandler): Promise<Record<string, unknown>>;
}

/** 数据库行类型 */
interface TaskRow {
  id: string;
  type: string;
  status: string;
  payload: string;
  submitted_at: number;
  started_at: number | null;
  completed_at: number | null;
  result: string | null;
  error: string | null;
  progress: number | null;
  lines: string | null;
}

/** 持久化任务队列 — SQLite (better-sqlite3) 后端 */
export class TaskQueue {
  private readonly handlers = new Map<TaskType, TaskHandler>();
  private db!: Database.Database;
  private idCounter = 0;
  private readonly dbPath?: string;
  private initialized = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath;
  }

  /** 初始化数据库（异步签名保持不变，首次使用时自动调用） */
  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    // better-sqlite3 内存库用 ':memory:'，文件库直接传路径（写入即落盘）
    if (this.dbPath) {
      mkdirSync(dirname(this.dbPath), { recursive: true });
      this.db = new Database(this.dbPath);
    } else {
      this.db = new Database(':memory:');
    }
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
    this.loadIdCounter();
    this.initialized = true;
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        payload TEXT NOT NULL,
        submitted_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        result TEXT,
        error TEXT,
        progress INTEGER DEFAULT 0,
        lines TEXT
      )
    `);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)`);
  }

  private loadIdCounter(): void {
    const row = this.db.prepare('SELECT MAX(id) as max_id FROM tasks').get() as { max_id: string | null } | undefined;
    const maxId = row?.max_id;
    if (maxId) {
      const match = maxId.match(/task-(\d+)/);
      if (match) this.idCounter = parseInt(match[1], 10);
    }
  }

  /** 注册任务处理器 */
  registerHandler(handler: TaskHandler): void {
    this.handlers.set(handler.type, handler);
  }

  /** 提交任务 */
  async submit(type: TaskType, payload: Record<string, unknown>): Promise<TaskRecord> {
    await this.ensureInit();
    const id = `task-${++this.idCounter}`;
    const task: TaskRecord = {
      id, type, status: TaskStatus.Pending, payload,
      submittedAt: Date.now(),
    };
    this.db.prepare(
      'INSERT INTO tasks (id, type, status, payload, submitted_at) VALUES (?, ?, ?, ?, ?)',
    ).run(id, type, TaskStatus.Pending, JSON.stringify(payload), task.submittedAt);
    return task;
  }

  /** 获取任务 */
  async get(taskId: string): Promise<TaskRecord | undefined> {
    await this.ensureInit();
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as TaskRow | undefined;
    return row ? this.toRecord(row) : undefined;
  }

  /** 列出任务（按类型筛选） */
  async list(type?: TaskType): Promise<TaskRecord[]> {
    await this.ensureInit();
    const rows = (type
      ? this.db.prepare('SELECT * FROM tasks WHERE type = ? ORDER BY submitted_at DESC').all(type)
      : this.db.prepare('SELECT * FROM tasks ORDER BY submitted_at DESC').all()) as TaskRow[];
    return rows.map((r) => this.toRecord(r));
  }

  /** 取消任务（仅 Pending 状态可取消） */
  async cancel(taskId: string): Promise<boolean> {
    await this.ensureInit();
    const row = this.db.prepare('SELECT status FROM tasks WHERE id = ?').get(taskId) as { status: string } | undefined;
    if (!row) return false;
    if (row.status !== TaskStatus.Pending) return false;
    const now = Date.now();
    this.db.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?').run(TaskStatus.Cancelled, now, taskId);
    return true;
  }

  /** 执行下一个待处理任务 */
  async processNext(onEvent?: (taskId: string, event: StreamEvent) => void): Promise<TaskRecord | undefined> {
    await this.ensureInit();
    const row = this.db.prepare('SELECT * FROM tasks WHERE status = ? ORDER BY submitted_at ASC LIMIT 1').get(TaskStatus.Pending) as TaskRow | undefined;
    if (!row) return undefined;

    const task = this.toRecord(row);
    const handler = this.handlers.get(task.type);
    if (!handler) return undefined;

    const now = Date.now();
    this.db.prepare('UPDATE tasks SET status = ?, started_at = ? WHERE id = ?').run(TaskStatus.Running, now, task.id);

    // 构建事件回调：更新 DB 中的 progress/lines 并通知外部
    const taskLines: string[] = [];
    const handlerCallback: TaskEventHandler | undefined = onEvent
      ? (event: StreamEvent) => {
          if (event.event === 'progress') {
            this.db.prepare('UPDATE tasks SET progress = ? WHERE id = ?').run(event.percent ?? 0, task.id);
          } else if (event.event === 'log') {
            taskLines.push(`[${event.level ?? 'info'}] ${event.message ?? ''}`);
            this.db.prepare('UPDATE tasks SET lines = ? WHERE id = ?').run(JSON.stringify(taskLines), task.id);
          }
          onEvent(task.id, event);
        }
      : undefined;

    try {
      const result = await handler.handle({ ...task, status: TaskStatus.Running, startedAt: now }, handlerCallback);
      this.db.prepare('UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?')
        .run(TaskStatus.Completed, JSON.stringify(result), Date.now(), task.id);
      return this.get(task.id);
    } catch (err) {
      this.db.prepare('UPDATE tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?')
        .run(TaskStatus.Failed, String(err), Date.now(), task.id);
      return this.get(task.id);
    }
  }

  /** 执行所有待处理任务 */
  async processAll(onEvent?: (taskId: string, event: StreamEvent) => void): Promise<TaskRecord[]> {
    const processed: TaskRecord[] = [];
    while (true) {
      const task = await this.processNext(onEvent);
      if (!task) break;
      processed.push(task);
    }
    return processed;
  }

  /** 关闭数据库连接 */
  close(): void {
    if (this.initialized) {
      this.db.close();
      this.initialized = false;
    }
  }

  private toRecord(row: TaskRow): TaskRecord {
    return {
      id: row.id,
      type: row.type as TaskType,
      status: row.status as TaskStatus,
      payload: JSON.parse(row.payload),
      submittedAt: row.submitted_at,
      startedAt: row.started_at ?? undefined,
      completedAt: row.completed_at ?? undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ?? undefined,
      progress: row.progress ?? undefined,
      lines: row.lines ? JSON.parse(row.lines) : undefined,
    };
  }
}
