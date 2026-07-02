import { TaskStatus, TaskType } from '../types.js';
import type { FastifyInstance } from 'fastify';

/** 任务记录（API 视图） */
export interface TaskView {
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

/** 任务事件（SSE 推送） */
export interface TaskEvent {
  type: 'progress' | 'log' | 'status' | 'result' | 'error';
  taskId: string;
  percent?: number;
  message?: string;
  level?: string;
  /** 任务结果 ID（诊断/回测），顶层透出供前端判别 */
  resultId?: string;
  /** 任务结果类型判别字段，顶层透出供前端分派渲染 */
  resultType?: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export type TaskEventHandler = (event: TaskEvent) => void;

/** 任务服务接口 — API 层通过此接口操作任务，不直接依赖 Worker */
export interface TaskService {
  submit(type: TaskType, payload: Record<string, unknown>): Promise<TaskView>;
  get(taskId: string): Promise<TaskView | undefined>;
  list(filter?: { type?: TaskType; status?: TaskStatus }): Promise<TaskView[]>;
  /** 订阅指定任务的事件 */
  subscribe(taskId: string, handler: TaskEventHandler): () => void;
  /** 更新任务（供 Worker 调用） */
  updateTask(taskId: string, updates: Partial<TaskView>, event?: TaskEvent): Promise<void>;
}

/** 内存实现（当前阶段） */
export class InMemoryTaskService implements TaskService {
  private readonly tasks = new Map<string, TaskView>();
  private readonly subscribers = new Map<string, Set<TaskEventHandler>>();
  private idCounter = 0;

  async submit(type: TaskType, payload: Record<string, unknown>): Promise<TaskView> {
    const id = `task-${++this.idCounter}`;
    const task: TaskView = {
      id,
      type,
      status: TaskStatus.Pending,
      payload,
      submittedAt: Date.now(),
      progress: 0,
      lines: [],
    };
    this.tasks.set(id, task);
    this._emit(id, { type: 'status', taskId: id, message: task.status });
    return task;
  }

  async get(taskId: string): Promise<TaskView | undefined> {
    return this.tasks.get(taskId);
  }

  async list(filter?: { type?: TaskType; status?: TaskStatus }): Promise<TaskView[]> {
    const all = Array.from(this.tasks.values());
    return all.filter((t) => {
      if (filter?.type && t.type !== filter.type) return false;
      if (filter?.status && t.status !== filter.status) return false;
      return true;
    });
  }

  subscribe(taskId: string, handler: TaskEventHandler): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(handler);
    return () => this.subscribers.get(taskId)?.delete(handler);
  }

  async updateTask(taskId: string, updates: Partial<TaskView>, event?: TaskEvent): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    Object.assign(task, updates);
    if (event) {
      this._emit(taskId, event);
    }
  }

  /** 内部：向任务订阅者推送事件 */
  private _emit(taskId: string, event: TaskEvent): void {
    this.subscribers.get(taskId)?.forEach((h) => h(event));
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    taskService: TaskService;
  }
}

export async function taskServicePlugin(
  app: FastifyInstance,
  options: { taskService: TaskService }
) {
  app.decorate('taskService', options.taskService);
}
