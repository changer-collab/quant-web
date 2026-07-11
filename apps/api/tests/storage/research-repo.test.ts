import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeApiDb, initApiDb } from '../../src/storage/connection.js';
import { SqliteResearchRepository } from '../../src/research/repository.js';
import { createEmptyCandidate, type ResearchSession } from '../../src/research/types.js';

const tempFiles: string[] = [];

afterEach(() => {
  closeApiDb(false);
  for (const file of tempFiles.splice(0)) rmSync(file, { force: true });
});

describe('SqliteResearchRepository', () => {
  it('每次研究写入后可从重启后的 SQLite 恢复', async () => {
    const dbPath = join(tmpdir(), `quantforge-research-${randomUUID()}.db`);
    tempFiles.push(dbPath);
    const db = await initApiDb(dbPath);
    const repo = new SqliteResearchRepository(db);
    const session: ResearchSession = {
      id: 'rs-persisted',
      strategy: 'dual_ma',
      title: '双均线研究',
      status: 'collecting',
      candidate: createEmptyCandidate('过滤震荡区间'),
      createdAt: 100,
      updatedAt: 100,
    };

    await repo.createSession(session);
    closeApiDb(false);

    const reopened = new SqliteResearchRepository(await initApiDb(dbPath));
    await expect(reopened.getSession(session.id)).resolves.toMatchObject({
      id: session.id,
      candidate: { initialHypothesis: '过滤震荡区间' },
    });
  });
});
