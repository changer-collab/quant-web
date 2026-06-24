import { describe, it, expect } from 'vitest';
import { TaskQueue } from '../src/queue.js';
import type { TaskHandler } from '../src/queue.js';
import { TaskType, TaskStatus } from '../src/types.js';

function makeHandler(type: TaskType, result: Record<string, unknown> = {}): TaskHandler {
  return { type, async handle() { return result; } };
}

function makeFailingHandler(type: TaskType): TaskHandler {
  return { type, async handle() { throw new Error('处理失败'); } };
}

describe('TaskQueue', () => {
  it('提交任务', async () => {
    const queue = new TaskQueue();
    const task = await queue.submit(TaskType.Backtest, { symbol: 'CSI500' });
    expect(task.id).toMatch(/^task-\d+$/);
    expect(task.status).toBe(TaskStatus.Pending);
  });

  it('获取任务', async () => {
    const queue = new TaskQueue();
    const task = await queue.submit(TaskType.Backtest, {});
    const fetched = await queue.get(task.id);
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(task.id);
    expect(await queue.get('nonexistent')).toBeUndefined();
  });

  it('列出任务', async () => {
    const queue = new TaskQueue();
    await queue.submit(TaskType.Backtest, {});
    await queue.submit(TaskType.Backtest, {});
    await queue.submit(TaskType.FactorCompute, {});
    expect(await queue.list()).toHaveLength(3);
    expect(await queue.list(TaskType.Backtest)).toHaveLength(2);
  });

  it('取消 Pending 任务', async () => {
    const queue = new TaskQueue();
    const task = await queue.submit(TaskType.Backtest, {});
    expect(await queue.cancel(task.id)).toBe(true);
    const cancelled = await queue.get(task.id);
    expect(cancelled!.status).toBe(TaskStatus.Cancelled);
  });

  it('不能取消非 Pending 任务', async () => {
    const queue = new TaskQueue();
    queue.registerHandler(makeHandler(TaskType.Backtest));
    const task = await queue.submit(TaskType.Backtest, {});
    await queue.processNext();
    expect(await queue.cancel(task.id)).toBe(false);
  });

  it('执行任务', async () => {
    const queue = new TaskQueue();
    queue.registerHandler(makeHandler(TaskType.Backtest, { returnCode: 0 }));
    const task = await queue.submit(TaskType.Backtest, { symbol: 'CSI500' });
    const processed = await queue.processNext();
    expect(processed).toBeDefined();
    expect(processed!.id).toBe(task.id);
    expect(processed!.status).toBe(TaskStatus.Completed);
    expect(processed!.result).toEqual({ returnCode: 0 });
  });

  it('任务失败', async () => {
    const queue = new TaskQueue();
    queue.registerHandler(makeFailingHandler(TaskType.Backtest));
    const task = await queue.submit(TaskType.Backtest, {});
    await queue.processNext();
    const failed = await queue.get(task.id);
    expect(failed!.status).toBe(TaskStatus.Failed);
    expect(failed!.error).toBe('Error: 处理失败');
  });

  it('processAll 执行所有待处理任务', async () => {
    const queue = new TaskQueue();
    queue.registerHandler(makeHandler(TaskType.Backtest));
    await queue.submit(TaskType.Backtest, {});
    await queue.submit(TaskType.Backtest, {});
    const processed = await queue.processAll();
    expect(processed).toHaveLength(2);
    expect(processed.every((t) => t.status === TaskStatus.Completed)).toBe(true);
  });
});
