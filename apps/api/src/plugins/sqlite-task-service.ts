import type { TaskService, TaskView, TaskEvent, TaskEventHandler } from './task-service.js';
import type { TaskRepository } from '@quant/data-center';
import { TaskStatus, TaskType } from '../types.js';

/** 将 data-center 的 TaskDefinition 映射为 API 层的 TaskView */
function mapToTaskView(raw: {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
  progress?: number;
  lines?: string[];
}): TaskView {
  return {
    id: raw.id,
    type: raw.type as TaskType,
    status: raw.status as TaskStatus,
    payload: raw.payload,
    submittedAt: raw.submittedAt,
    startedAt: raw.startedAt,
    completedAt: raw.completedAt,
    result: raw.result,
    error: raw.error,
    progress: raw.progress,
    lines: raw.lines,
  };
}

export class SqliteTaskService implements TaskService {
  private readonly subscribers = new Map<string, Set<TaskEventHandler>>();
  private idCounter = 0;

  constructor(
    private repo: TaskRepository,
  ) {}

  async init(): Promise<void> {
    // 从数据库加载最大 ID
    const tasks = await this.repo.list();
    if (tasks.length > 0) {
      const maxId = Math.max(...tasks.map((t) => {
        const num = parseInt(t.id.replace('task-', ''), 10);
        return isNaN(num) ? 0 : num;
      }));
      this.idCounter = maxId;
    }
  }

  async submit(type: TaskType, payload: Record<string, unknown>): Promise<TaskView> {
    const id = `task-${++this.idCounter}`;
    const task: TaskView = {
      id, type, status: TaskStatus.Pending, payload,
      submittedAt: Date.now(),
      progress: 0,
      lines: [],
    };
    await this.repo.save(task);
    this._emit(id, { type: 'status', taskId: id, message: task.status });
    return task;
  }

  async get(taskId: string): Promise<TaskView | undefined> {
    const raw = await this.repo.getById(taskId);
    return raw ? mapToTaskView(raw) : undefined;
  }

  async list(filter?: { type?: TaskType; status?: TaskStatus }): Promise<TaskView[]> {
    const rawList = await this.repo.list(filter);
    return rawList.map(mapToTaskView);
  }

  subscribe(taskId: string, handler: TaskEventHandler): () => void {
    if (!this.subscribers.has(taskId)) {
      this.subscribers.set(taskId, new Set());
    }
    this.subscribers.get(taskId)!.add(handler);
    return () => this.subscribers.get(taskId)?.delete(handler);
  }

  async updateTask(taskId: string, updates: Partial<TaskView>, event?: TaskEvent): Promise<void> {
    const task = await this.repo.getById(taskId);
    if (!task) return;

    const updated = { ...task, ...updates };
    await this.repo.save(updated);

    if (event) {
      this._emit(taskId, event);
    }
  }

  private _emit(taskId: string, event: TaskEvent): void {
    this.subscribers.get(taskId)?.forEach((h) => h(event));
  }
}
