import { describe, expect, it, vi } from 'vitest';
import { GitCollector, inferStrategyFromFiles } from '../src/git-collector.js';

describe('GitCollector', () => {
  it('首次扫描仅建立当前 HEAD 基线，不回灌历史提交', async () => {
    const saveCursor = vi.fn(async () => {});
    const collector = new GitCollector({
      cwd: 'C:/repo',
      api: {
        getCursor: async () => undefined,
        saveCursor,
        ingestEvent: async () => {},
      },
      runGit: async () => 'head-1\n',
    });

    await expect(collector.scan()).resolves.toEqual({ baseline: true, collected: 0 });
    expect(saveCursor).toHaveBeenCalledWith('git', 'head-1');
  });

  it('从游标之后按顺序保存提交摘要和涉及文件', async () => {
    const ingestEvent = vi.fn(async () => {});
    const saveCursor = vi.fn(async () => {});
    const runGit = vi.fn(async (args: string[]) => {
      if (args[0] === 'rev-parse') return 'head-2\n';
      if (args[0] === 'rev-list') return 'commit-a\ncommit-b\n';
      if (args[0] === 'show' && args.at(-1) === 'commit-a') return '调优双均线\x1f1720000000\n';
      if (args[0] === 'show' && args.at(-1) === 'commit-b') return '调整公共样式\x1f1720000100\n';
      if (args[0] === 'diff-tree' && args.at(-1) === 'commit-a') {
        return 'packages/strategies/quantforge_strategies/combined/dual_ma.py\n';
      }
      if (args[0] === 'diff-tree' && args.at(-1) === 'commit-b') return 'apps/web/src/App.tsx\n';
      throw new Error(`unexpected git command: ${args.join(' ')}`);
    });
    const collector = new GitCollector({
      cwd: 'C:/repo',
      api: { getCursor: async () => 'old-head', saveCursor, ingestEvent },
      runGit,
    });

    await expect(collector.scan()).resolves.toEqual({ baseline: false, collected: 2 });
    expect(ingestEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        dedupeKey: 'git:commit-a',
        payload: expect.objectContaining({ strategy: 'dual_ma', files: expect.any(Array) }),
      })
    );
    expect(ingestEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ dedupeKey: 'git:commit-b', payload: expect.not.objectContaining({ strategy: expect.anything() }) })
    );
    expect(saveCursor).toHaveBeenLastCalledWith('git', 'commit-b');
  });
});

describe('inferStrategyFromFiles', () => {
  it('仅在唯一 combined 策略实现文件时自动归类', () => {
    expect(inferStrategyFromFiles(['packages/strategies/quantforge_strategies/combined/dual_ma.py'])).toBe(
      'dual_ma'
    );
    expect(
      inferStrategyFromFiles([
        'packages/strategies/quantforge_strategies/combined/dual_ma.py',
        'packages/strategies/quantforge_strategies/combined/rsi.py',
      ])
    ).toBeUndefined();
  });
});
