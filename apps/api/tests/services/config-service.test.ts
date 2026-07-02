/**
 * StrategyConfigService 单元测试
 *
 * 覆盖：
 * - buildDefaultSnapshot：默认快照构造 / canonical hash 确定性 / category 降级 / 校验
 * - getOrDefault：无数据 → persisted=false + 默认快照；有数据 → persisted=true + 持久化值
 * - save：首存 / expectedHash 匹配 / hash 冲突抛 ConfigHashConflictError / 空 strategy 拒绝
 * - ConfigHashConflictError 类和状态码
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StrategyConfigService,
  ConfigHashConflictError,
} from '../../src/services/config-service.js';
import type { IConfigRepo } from '../../src/repositories/interfaces.js';
import type { ConfigSnapshot, StrategyCategory } from '../../src/types.js';

// ─── Mock Repository ──────────────────────────────────────────────────

function createMockRepo(): IConfigRepo {
  let store: Record<string, ConfigSnapshot> = {};

  return {
    async get(strategy: string) {
      return store[strategy] ?? null;
    },
    async save(snapshot: ConfigSnapshot) {
      store[snapshot.strategy] = { ...snapshot, hash: snapshot.hash ?? '', updatedAt: Date.now() };
    },
  };
}

// ─── Test Suite ───────────────────────────────────────────────────────

describe('StrategyConfigService', () => {
  let repo: IConfigRepo;
  let service: StrategyConfigService;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = createMockRepo();
    service = new StrategyConfigService(repo);
  });

  // ── buildDefaultSnapshot ─────────────────────────────────────────

  describe('buildDefaultSnapshot', () => {
    it('创建包含正确字段的默认快照', () => {
      const snapshot = service.buildDefaultSnapshot('dual_ma', '1.0');

      expect(snapshot.strategy).toBe('dual_ma');
      expect(snapshot.strategyVersion).toBe('1.0');
      expect(snapshot.schemaVersion).toBe(1);
      expect(snapshot.category).toBe('non_factor');
      expect(snapshot.params).toEqual({});
      expect(snapshot.hash).toBeTruthy();
      expect(typeof snapshot.hash).toBe('string');
      expect(snapshot.hash!.length).toBeGreaterThan(0);
      expect(snapshot.updatedAt).toBeGreaterThan(0);
    });

    it('category 未指定时默认为 non_factor', () => {
      const s1 = service.buildDefaultSnapshot('test', '1.0');
      expect(s1.category).toBe('non_factor');
    });

    it('支持显式指定 category', () => {
      const s1 = service.buildDefaultSnapshot('test', '1.0', 'factor_based');
      expect(s1.category).toBe('factor_based');

      const s2 = service.buildDefaultSnapshot('test', '1.0', 'transitional');
      expect(s2.category).toBe('transitional');
    });

    it('无效 category 抛出错误', () => {
      expect(() =>
        service.buildDefaultSnapshot('test', '1.0', 'trash_cat' as StrategyCategory)
      ).toThrow('Invalid category');
    });

    it('相同输入产生相同 hash（确定性）', () => {
      const s1 = service.buildDefaultSnapshot('dual_ma', '1.0', 'non_factor');
      const s2 = service.buildDefaultSnapshot('dual_ma', '1.0', 'non_factor');
      expect(s1.hash).toBe(s2.hash);
    });

    it('不同 strategy 产生不同 hash', () => {
      const s1 = service.buildDefaultSnapshot('dual_ma', '1.0');
      const s2 = service.buildDefaultSnapshot('macd', '1.0');
      expect(s1.hash).not.toBe(s2.hash);
    });

    it('不同 category 产生不同 hash', () => {
      const s1 = service.buildDefaultSnapshot('dual_ma', '1.0', 'non_factor');
      const s2 = service.buildDefaultSnapshot('dual_ma', '1.0', 'factor_based');
      expect(s1.hash).not.toBe(s2.hash);
    });

    it('不同 strategyVersion 产生不同 hash', () => {
      const s1 = service.buildDefaultSnapshot('dual_ma', '1.0');
      const s2 = service.buildDefaultSnapshot('dual_ma', '2.0');
      expect(s1.hash).not.toBe(s2.hash);
    });
  });

  // ── getOrDefault ────────────────────────────────────────────────

  describe('getOrDefault', () => {
    it('无 DB 数据 → {persisted:false, configSnapshot:默认快照}', async () => {
      const result = await service.getOrDefault('dual_ma', '1.0');

      expect(result.persisted).toBe(false);
      expect(result.configSnapshot.strategy).toBe('dual_ma');
      expect(result.configSnapshot.strategyVersion).toBe('1.0');
      expect(result.configSnapshot.category).toBe('non_factor');
      expect(result.configSnapshot.params).toEqual({});
      expect(result.configSnapshot.hash).toBeTruthy();
    });

    it('传入 category 时默认快照使用指定分类', async () => {
      const result = await service.getOrDefault('macd', '1.0', 'factor_based');

      expect(result.persisted).toBe(false);
      expect(result.configSnapshot.category).toBe('factor_based');
    });

    it('有 DB 数据 → {persisted:true, configSnapshot:持久化值}', async () => {
      // 先手工写入 repo
      await repo.save({
        strategy: 'dual_ma',
        params: { period: 20, offset: 5 },
        hash: 'sha256:abc123',
      });

      const result = await service.getOrDefault('dual_ma', '1.0');

      expect(result.persisted).toBe(true);
      expect(result.configSnapshot.strategy).toBe('dual_ma');
      expect(result.configSnapshot.params).toEqual({ period: 20, offset: 5 });
      expect(result.configSnapshot.hash).toBe('sha256:abc123');
    });

    it('先 save → 再 getOrDefault → {persisted:true} 与保存值一致', async () => {
      const saved = await service.save({
        strategy: 'dual_ma',
        params: { period: 20 },
      });

      const result = await service.getOrDefault('dual_ma', '1.0');
      expect(result.persisted).toBe(true);
      expect(result.configSnapshot.params).toEqual({ period: 20 });
      expect(result.configSnapshot.hash).toBe(saved.hash);
    });
  });

  // ── save ────────────────────────────────────────────────────────

  describe('save', () => {
    it('保存成功返回 ConfigSnapshot', async () => {
      const result = await service.save({
        strategy: 'dual_ma',
        params: { period: 20 },
      });

      expect(result.strategy).toBe('dual_ma');
      expect(result.params).toEqual({ period: 20 });
      expect(result.hash).toBe('');
      expect(result.updatedAt).toBeGreaterThan(0);
    });

    it('无 expectedHash 时首存成功', async () => {
      const result = await service.save({
        strategy: 'dual_ma',
        params: { period: 20 },
        hash: 'sha256:abc',
        category: 'non_factor',
      });

      expect(result.hash).toBe('sha256:abc');
    });

    it('expectedHash 匹配 → 保存成功', async () => {
      // 首存
      await service.save({
        strategy: 'dual_ma',
        params: { period: 20 },
        hash: 'hash_v1',
      });

      // 第二次保存带正确的 expectedHash
      const result = await service.save(
        {
          strategy: 'dual_ma',
          params: { period: 20, offset: 5 },
          hash: 'hash_v2',
        },
        'hash_v1'
      );

      expect(result.hash).toBe('hash_v2');
      expect(result.params).toEqual({ period: 20, offset: 5 });
    });

    it('expectedHash 与 DB 不一致 → 抛 ConfigHashConflictError', async () => {
      // 首存
      await service.save({
        strategy: 'dual_ma',
        params: { period: 20 },
        hash: 'hash_v1',
      });

      // 尝试用错误的 expectedHash 更新
      const promise = service.save(
        {
          strategy: 'dual_ma',
          params: { period: 10 },
          hash: 'hash_v2',
        },
        'wrong_hash'
      );

      await expect(promise).rejects.toThrow(ConfigHashConflictError);

      // 验证冲突错误携带正确信息
      try {
        await promise;
      } catch (e) {
        const err = e as ConfigHashConflictError;
        expect(err.expectedHash).toBe('wrong_hash');
        expect(err.currentHash).toBe('hash_v1');
        expect(err.currentSnapshot.strategy).toBe('dual_ma');
        expect(err.currentSnapshot.params).toEqual({ period: 20 });
        expect(err.statusCode).toBe(409);
      }
    });

    it('expectedHash 无 DB 数据时不做冲突检测', async () => {
      // 策略不存在，但 expectedHash 设为某个值 → 应跳过冲突检测直接保存
      const result = await service.save(
        {
          strategy: 'new_strategy',
          params: { alpha: 1 },
          hash: 'hash_new',
        },
        'some_hash'
      );

      expect(result.strategy).toBe('new_strategy');
      expect(result.hash).toBe('hash_new');
    });

    it('空 strategy 抛出错误', async () => {
      await expect(
        service.save({
          strategy: '',
          params: {},
        })
      ).rejects.toThrow('strategy is required');
    });

    it('无效 category 抛出错误', async () => {
      await expect(
        service.save({
          strategy: 'test',
          params: {},
          category: 'trash_cat' as StrategyCategory,
        })
      ).rejects.toThrow('Invalid category');
    });
  });

  // ── ConfigHashConflictError ─────────────────────────────────────

  describe('ConfigHashConflictError', () => {
    it('是 Error 的子类且 statusCode=409', () => {
      const err = new ConfigHashConflictError('expected', 'current', {
        strategy: 'test',
        params: {},
      });

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(ConfigHashConflictError);
      expect(err.name).toBe('ConfigHashConflictError');
      expect(err.statusCode).toBe(409);
      expect(err.expectedHash).toBe('expected');
      expect(err.currentHash).toBe('current');
      expect(err.currentSnapshot.strategy).toBe('test');
    });

    it('错误消息包含预期和当前 hash', () => {
      const err = new ConfigHashConflictError('abc', 'xyz', { strategy: 'test', params: {} });
      expect(err.message).toContain('abc');
      expect(err.message).toContain('xyz');
    });
  });
});
