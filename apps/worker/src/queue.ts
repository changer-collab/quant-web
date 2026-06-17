import { TaskStatus, TaskType, type StreamEvent } from './types.js';
import initSqlJs, { type Database } from 'sql.js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
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

/** 持久化任务队列 — SQLite (sql.js) 后端 */
export class TaskQueue {
  private readonly handlers = new Map<TaskType, TaskHandler>();
  private db!: Database;
  private idCounter = 0;
  private readonly dbPath?: string;
  private initialized = false;

  constructor(dbPath?: string) {
    this.dbPath = dbPath;
  }

  /** 初始化数据库（异步，首次使用时自动调用） */
  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    const SQL = await initSqlJs();
    if (this.dbPath) {
      mkdirSync(dirname(this.dbPath), { recursive: true });
      try {
        const buf = readFileSync(this.dbPath);
        this.db = new SQL.Database(buf);
      } catch {
        this.db = new SQL.Database();
      }
    } else {
      this.db = new SQL.Database();
    }
    this.initSchema();
    this.loadIdCounter();
    this.initialized = true;
  }

  private initSchema(): void {
    this.db.run(`
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
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type)`);
    this.persist();
  }

  private loadIdCounter(): void {
    const rows = this.db.exec('SELECT MAX(id) as max_id FROM tasks');
    if (rows.length > 0 && rows[0].values.length > 0) {
      const maxId = rows[0].values[0][0] as string | null;
      if (maxId) {
        const match = maxId.match(/task-(\d+)/);
        if (match) this.idCounter = parseInt(match[1], 10);
      }
    }
  }

  private persist(): void {
    if (!this.dbPath) return;
    const buf = this.db.export();
    writeFileSync(this.dbPath, Buffer.from(buf));
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
    this.db.run(
      'INSERT INTO tasks (id, type, status, payload, submitted_at) VALUES (?, ?, ?, ?, ?)',
      [id, type, TaskStatus.Pending, JSON.stringify(payload), task.submittedAt],
    );
    this.persist();
    return task;
  }

  /** 获取任务 */
  async get(taskId: string): Promise<TaskRecord | undefined> {
    await this.ensureInit();
    const rows = this.db.exec('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (rows.length === 0 || rows[0].values.length === 0) return undefined;
    return this.toRecord(rows[0].columns, rows[0].values[0]);
  }

  /** 列出任务（按类型筛选） */
  async list(type?: TaskType): Promise<TaskRecord[]> {
    await this.ensureInit();
    const rows = type
      ? this.db.exec('SELECT * FROM tasks WHERE type = ? ORDER BY submitted_at DESC', [type])
      : this.db.exec('SELECT * FROM tasks ORDER BY submitted_at DESC');
    if (rows.length === 0) return [];
    return rows[0].values.map((v) => this.toRecord(rows[0].columns, v));
  }

  /** 取消任务（仅 Pending 状态可取消） */
  async cancel(taskId: string): Promise<boolean> {
    await this.ensureInit();
    const rows = this.db.exec('SELECT status FROM tasks WHERE id = ?', [taskId]);
    if (rows.length === 0 || rows[0].values.length === 0) return false;
    const status = rows[0].values[0][0] as string;
    if (status !== TaskStatus.Pending) return false;
    const now = Date.now();
    this.db.run('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?', [TaskStatus.Cancelled, now, taskId]);
    this.persist();
    return true;
  }

  /** 执行下一个待处理任务 */
  async processNext(onEvent?: (taskId: string, event: StreamEvent) => void): Promise<TaskRecord | undefined> {
    await this.ensureInit();
    const rows = this.db.exec('SELECT * FROM tasks WHERE status = ? ORDER BY submitted_at ASC LIMIT 1', [TaskStatus.Pending]);
    if (rows.length === 0 || rows[0].values.length === 0) return undefined;

    const task = this.toRecord(rows[0].columns, rows[0].values[0]);
    const handler = this.handlers.get(task.type);
    if (!handler) return undefined;

    const now = Date.now();
    this.db.run('UPDATE tasks SET status = ?, started_at = ? WHERE id = ?', [TaskStatus.Running, now, task.id]);
    this.persist();

    // 构建事件回调：更新 DB 中的 progress/lines 并通知外部
    const taskLines: string[] = [];
    const handlerCallback: TaskEventHandler | undefined = onEvent
      ? (event: StreamEvent) => {
          if (event.event === 'progress') {
            this.db.run('UPDATE tasks SET progress = ? WHERE id = ?', [event.percent ?? 0, task.id]);
            this.persist();
          } else if (event.event === 'log') {
            taskLines.push(`[${event.level ?? 'info'}] ${event.message ?? ''}`);
            this.db.run('UPDATE tasks SET lines = ? WHERE id = ?', [JSON.stringify(taskLines), task.id]);
            this.persist();
          }
          onEvent(task.id, event);
        }
      : undefined;

    try {
      const result = await handler.handle({ ...task, status: TaskStatus.Running, startedAt: now }, handlerCallback);
      this.db.run('UPDATE tasks SET status = ?, result = ?, completed_at = ? WHERE id = ?',
        [TaskStatus.Completed, JSON.stringify(result), Date.now(), task.id]);
      this.persist();
      return this.get(task.id);
    } catch (err) {
      this.db.run('UPDATE tasks SET status = ?, error = ?, completed_at = ? WHERE id = ?',
        [TaskStatus.Failed, String(err), Date.now(), task.id]);
      this.persist();
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
      this.persist();
      this.db.close();
      this.initialized = false;
    }
  }

  private toRecord(columns: string[], values: (string | number | null | Uint8Array)[]): TaskRecord {
    const idx = (name: string) => columns.indexOf(name);
    return {
      id: values[idx('id')] as string,
      type: values[idx('type')] as TaskType,
      status: values[idx('status')] as TaskStatus,
      payload: JSON.parse(values[idx('payload')] as string),
      submittedAt: values[idx('submitted_at')] as number,
      startedAt: (values[idx('started_at')] as number | null) ?? undefined,
      completedAt: (values[idx('completed_at')] as number | null) ?? undefined,
      result: values[idx('result')] ? JSON.parse(values[idx('result')] as string) : undefined,
      error: (values[idx('error')] as string | null) ?? undefined,
      progress: (values[idx('progress')] as number | null) ?? undefined,
      lines: values[idx('lines')] ? JSON.parse(values[idx('lines')] as string) : undefined,
    };
  }
}
