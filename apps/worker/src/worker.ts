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
