import { TaskQueue } from './queue.js';
import type { TaskHandler } from './queue.js';
import type { DataCenter } from '@quant/data-center';
import type { TaskType } from './types.js';

/** Worker 配置 */
export interface WorkerConfig {
  dataCenter: DataCenter;
  handlers: TaskHandler[];
  /** 任务队列持久化路径，不传则使用内存队列 */
  queueDbPath?: string;
}

/** Worker 主类 */
export class Worker {
  public readonly queue: TaskQueue;
  private readonly dataCenter: DataCenter;

  constructor(config: WorkerConfig) {
    this.queue = new TaskQueue(config.queueDbPath);
    this.dataCenter = config.dataCenter;
    for (const handler of config.handlers) {
      this.queue.registerHandler(handler);
    }
  }

  /** 提交任务 */
  async submit(type: TaskType, payload: Record<string, unknown>) {
    return this.queue.submit(type, payload);
  }

  /** 查询任务 */
  async getTask(taskId: string) {
    return this.queue.get(taskId);
  }

  /** 列出任务 */
  async listTasks(type?: TaskType) {
    return this.queue.list(type);
  }

  /** 处理所有待执行任务 */
  async processAll() {
    return this.queue.processAll();
  }

  /** 关闭 Worker */
  async close() {
    this.queue.close();
    await this.dataCenter.close();
  }
}
