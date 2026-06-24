import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createDataCenter } from '../../src/storage/factory.js';
import type { DataCenter } from '../../src/storage/factory.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

describe('SqliteTaskRepository', () => {
  let dataCenter: DataCenter;
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'quant-task-test-'));
    dataCenter = await createDataCenter({ dbPath: path.join(tmpDir, 'test.db') });
  });

  afterEach(async () => {
    await dataCenter.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('保存并查询任务', async () => {
    const task = {
      id: 'task-1',
      type: 'backtest',
      status: 'pending',
      payload: { strategyId: 'test-strategy' },
      submittedAt: Date.now(),
      progress: 0,
      lines: [],
    };

    await dataCenter.repos.tasks.save(task);
    const retrieved = await dataCenter.repos.tasks.getById('task-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('task-1');
    expect(retrieved?.type).toBe('backtest');
    expect(retrieved?.status).toBe('pending');
    expect(retrieved?.payload).toEqual({ strategyId: 'test-strategy' });
  });

  it('更新任务状态', async () => {
    const task = {
      id: 'task-2',
      type: 'factor_eval',
      status: 'pending',
      payload: { factorId: 'test-factor' },
      submittedAt: Date.now(),
      progress: 0,
      lines: [],
    };

    await dataCenter.repos.tasks.save(task);

    const updated = {
      ...task,
      status: 'running',
      progress: 50,
      lines: ['Processing...'],
    };
    await dataCenter.repos.tasks.save(updated);

    const retrieved = await dataCenter.repos.tasks.getById('task-2');
    expect(retrieved?.status).toBe('running');
    expect(retrieved?.progress).toBe(50);
    expect(retrieved?.lines).toEqual(['Processing...']);
  });

  it('按类型和状态过滤任务', async () => {
    const tasks = [
      {
        id: 'task-3',
        type: 'backtest',
        status: 'pending',
        payload: {},
        submittedAt: Date.now(),
      },
      {
        id: 'task-4',
        type: 'factor_eval',
        status: 'pending',
        payload: {},
        submittedAt: Date.now(),
      },
      {
        id: 'task-5',
        type: 'backtest',
        status: 'completed',
        payload: {},
        submittedAt: Date.now(),
        completedAt: Date.now(),
      },
    ];

    for (const task of tasks) {
      await dataCenter.repos.tasks.save(task);
    }

    const backtestTasks = await dataCenter.repos.tasks.list({ type: 'backtest' });
    expect(backtestTasks.length).toBe(2);

    const pendingTasks = await dataCenter.repos.tasks.list({ status: 'pending' });
    expect(pendingTasks.length).toBe(2);

    const completedBacktests = await dataCenter.repos.tasks.list({
      type: 'backtest',
      status: 'completed',
    });
    expect(completedBacktests.length).toBe(1);
  });

  it('查询不存在的任务返回 undefined', async () => {
    const retrieved = await dataCenter.repos.tasks.getById('non-existent');
    expect(retrieved).toBeUndefined();
  });
});
