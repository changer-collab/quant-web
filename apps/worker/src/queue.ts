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
