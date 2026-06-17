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
}

/** 任务服务接口 — API 层通过此接口操作任务，不直接依赖 Worker */
export interface TaskService {
  submit(type: TaskType, payload: Record<string, unknown>): TaskView;
  get(taskId: string): TaskView | undefined;
  list(type?: TaskType): TaskView[];
}

/** 内存实现（当前阶段） */
export class InMemoryTaskService implements TaskService {
  private readonly tasks = new Map<string, TaskView>();
  private idCounter = 0;

  submit(type: TaskType, payload: Record<string, unknown>): TaskView {
    const id = `task-${++this.idCounter}`;
    const task: TaskView = {
      id, type, status: TaskStatus.Pending, payload,
      submittedAt: Date.now(),
    };
    this.tasks.set(id, task);
    return task;
  }

  get(taskId: string): TaskView | undefined {
    return this.tasks.get(taskId);
  }

  list(type?: TaskType): TaskView[] {
    const all = Array.from(this.tasks.values());
    return type ? all.filter((t) => t.type === type) : all;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    taskService: TaskService;
  }
}

export async function taskServicePlugin(
  app: FastifyInstance,
  options: { taskService: TaskService },
) {
  app.decorate('taskService', options.taskService);
}
