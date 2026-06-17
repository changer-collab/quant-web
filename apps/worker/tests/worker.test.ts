import { describe, it, expect } from 'vitest';
import { Worker } from '../src/worker.js';
import { TaskType, TaskStatus } from '../src/types.js';
import type { TaskHandler, TaskRecord } from '../src/queue.js';

function makeSimpleHandler(type: TaskType): TaskHandler {
  return { type, async handle(task: TaskRecord) { return { processed: true, taskId: task.id }; } };
}

function createMockDataCenter() {
  return {
    providers: {
      reference: {} as never,
      market: {} as never,
      fundamental: {} as never,
      event: {} as never,
      l2: {} as never,
      quality: {} as never,
    },
    repos: {} as never,
    exporter: {} as never,
    close: async () => {},
    status: () => 'ready' as const,
    isClosed: () => false,
    flush: () => {},
    healthCheck: () => ({ status: 'healthy' as const, dcStatus: 'ready' as const }),
    [Symbol.asyncDispose]: async () => {},
  };
}

describe('Worker', () => {
  it('提交和处理任务', async () => {
    const dc = createMockDataCenter();
    const worker = new Worker({ dataCenter: dc, handlers: [makeSimpleHandler(TaskType.Backtest)] });
    const task = worker.submit(TaskType.Backtest, { symbol: 'TEST' });
    expect(task.status).toBe(TaskStatus.Pending);
    await worker.processAll();
    expect(task.status).toBe(TaskStatus.Completed);
    expect(worker.getTask(task.id)).toBeDefined();
    await worker.close();
  });

  it('列出任务', async () => {
    const dc = createMockDataCenter();
    const worker = new Worker({ dataCenter: dc, handlers: [makeSimpleHandler(TaskType.Backtest)] });
    worker.submit(TaskType.Backtest, { symbol: 'A' });
    worker.submit(TaskType.Backtest, { symbol: 'B' });
    expect(worker.listTasks()).toHaveLength(2);
    await worker.close();
  });

  it('按类型筛选任务', async () => {
    const dc = createMockDataCenter();
    const worker = new Worker({
      dataCenter: dc,
      handlers: [makeSimpleHandler(TaskType.Backtest), makeSimpleHandler(TaskType.FactorCompute)],
    });
    worker.submit(TaskType.Backtest, { symbol: 'A' });
    worker.submit(TaskType.FactorCompute, { factorIds: ['f1'] });
    expect(worker.listTasks(TaskType.Backtest)).toHaveLength(1);
    expect(worker.listTasks(TaskType.FactorCompute)).toHaveLength(1);
    await worker.close();
  });
});
