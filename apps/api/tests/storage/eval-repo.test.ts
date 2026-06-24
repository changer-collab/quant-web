import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initApiDb, closeApiDb } from '../../src/storage/connection.js';
import { FactorEvaluationRepository } from '../../src/storage/eval-repo.js';
import type { FactorEvaluation } from '../../src/types.js';
import { unlinkSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('FactorEvaluationRepository', () => {
  const testDbPath = resolve(process.cwd(), 'data', 'test-eval.db');

  beforeEach(async () => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    await initApiDb(testDbPath);
  });

  afterEach(() => {
    closeApiDb(false);
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  it('保存并查询评估结果', async () => {
    const repo = new FactorEvaluationRepository();
    const evaluation: FactorEvaluation = {
      id: 'eval-1',
      factorId: 'factor-1',
      taskId: 'task-1',
      createdAt: Date.now(),
      icMean: 0.05,
      icStd: 0.02,
      rankIcMean: 0.06,
      rankIcStd: 0.025,
      icir: 2.5,
      rankIcir: 2.4,
      groupReturns: [0.01, 0.02, 0.03, 0.04, 0.05],
      evalData: { ic: { mean: 0.05 } },
    };

    await repo.save(evaluation);
    const retrieved = await repo.getById('eval-1');

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe('eval-1');
    expect(retrieved?.icMean).toBe(0.05);
    expect(retrieved?.groupReturns).toEqual([0.01, 0.02, 0.03, 0.04, 0.05]);
  });

  it('按因子 ID 查询评估列表', async () => {
    const repo = new FactorEvaluationRepository();
    const evaluations: FactorEvaluation[] = [
      {
        id: 'eval-1',
        factorId: 'factor-1',
        taskId: 'task-1',
        createdAt: Date.now() - 1000,
        icMean: 0.04,
        evalData: {},
      },
      {
        id: 'eval-2',
        factorId: 'factor-1',
        taskId: 'task-2',
        createdAt: Date.now(),
        icMean: 0.05,
        evalData: {},
      },
    ];

    for (const e of evaluations) {
      await repo.save(e);
    }

    const results = await repo.getByFactorId('factor-1');
    expect(results.length).toBe(2);
    expect(results[0].id).toBe('eval-2'); // 最新的在前
  });
});