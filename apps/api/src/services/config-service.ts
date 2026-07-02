/**
 * 策略配置服务
 *
 * 纯业务逻辑层，不依赖 Drizzle/sql.js，只依赖 Repository 接口。
 *
 * Phase 3b 新增：
 * - buildDefaultSnapshot() — 构造带 canonical SHA256 hash 的默认快照
 * - getOrDefault() — 有 DB 数据返回 persisted:true，无则返回默认快照
 * - save() — 带 expectedHash 乐观锁，冲突抛 ConfigHashConflictError
 * - 向后兼容：getConfig/saveConfig 保留（旧名，story-9 路由更新后移除）
 */
import { createHash } from 'node:crypto';
import type { IConfigRepo } from '../repositories/interfaces.js';
import type { ConfigSnapshot, StrategyCategory } from '../types.js';

// ─── Canonical 分类白名单（与 types.ts StrategyCategory 对齐） ────────
const CANONICAL_CATEGORIES: ReadonlySet<string> = new Set([
  'factor_based',
  'non_factor',
  'transitional',
]);

// ─── 异常类 ────────────────────────────────────────────────────────────

/**
 * 配置 hash 冲突错误
 *
 * expectedHash 与 DB 当前 hash 不一致时抛出，route 层可据此返回 409。
 */
export class ConfigHashConflictError extends Error {
  public readonly statusCode = 409;

  constructor(
    public readonly expectedHash: string,
    public readonly currentHash: string,
    public readonly currentSnapshot: ConfigSnapshot,
  ) {
    super(`Config hash conflict: expected ${expectedHash}, current ${currentHash}`);
    this.name = 'ConfigHashConflictError';
  }
}

// ─── 辅助函数 ──────────────────────────────────────────────────────────

/**
 * 生成 canonical JSON 字符串
 *
 * 规则：键按字典序排序 → 无空格序列化。
 * 相同语义对象（键集相同，值相同）不论键定义顺序都产生相同 JSON。
 */
function canonicalJson(obj: Record<string, unknown>): string {
  const sortedKeys = Object.keys(obj).sort();
  return JSON.stringify(obj, sortedKeys);
}

/**
 * 校验策略分类是否属于 canonical 3 值
 */
function assertCanonicalCategory(category?: string): asserts category is StrategyCategory | undefined {
  if (category !== undefined && !CANONICAL_CATEGORIES.has(category)) {
    throw new Error(`Invalid category: "${category}". Must be one of: ${[...CANONICAL_CATEGORIES].join(', ')}`);
  }
}

// ─── 服务类 ────────────────────────────────────────────────────────────

export class StrategyConfigService {
  constructor(private repo: IConfigRepo) {}

  /**
   * 构建默认配置快照
   *
   * 当策略尚无持久化配置时，生成一个语义确定且可追踪的默认值。
   * hash = SHA256(canonicalJSON({strategy, strategyVersion, category, params:{}}))
   */
  buildDefaultSnapshot(
    strategy: string,
    strategyVersion: string,
    category?: StrategyCategory,
  ): ConfigSnapshot {
    assertCanonicalCategory(category);

    const resolvedCategory: StrategyCategory = category ?? 'non_factor';
    const params: Record<string, unknown> = {};

    // canonical JSON → SHA256 → hex
    const canonical = canonicalJson({
      strategy,
      strategyVersion,
      category: resolvedCategory,
      params,
    });
    const hash = createHash('sha256').update(canonical).digest('hex');

    return {
      strategy,
      schemaVersion: 1,
      strategyVersion,
      category: resolvedCategory,
      params,
      hash,
      updatedAt: Date.now(),
    };
  }

  /**
   * 获取或构造策略配置
   *
   * - DB 有数据 → { persisted: true,  configSnapshot: 持久化值 }
   * - DB 无数据 → { persisted: false, configSnapshot: 默认快照 }
   */
  async getOrDefault(
    strategy: string,
    strategyVersion: string,
    category?: StrategyCategory,
  ): Promise<{ persisted: boolean; configSnapshot: ConfigSnapshot }> {
    const existing = await this.repo.get(strategy);

    if (existing) {
      return {
        persisted: true,
        configSnapshot: {
          ...existing,
          strategyVersion,
        },
      };
    }

    return {
      persisted: false,
      configSnapshot: this.buildDefaultSnapshot(strategy, strategyVersion, category),
    };
  }

  /**
   * 保存配置（含乐观锁）
   *
   * - expectedHash 提供且与 DB 当前 hash 不匹配 → 抛 ConfigHashConflictError
   * - expectedHash 未提供 → 无条件写入（首存）
   * - 保存成功 → 返回保存后的 ConfigSnapshot
   */
  async save(
    snapshot: ConfigSnapshot,
    expectedHash?: string,
  ): Promise<ConfigSnapshot> {
    // 校验：空 strategy
    if (!snapshot.strategy) {
      throw new Error('strategy is required');
    }

    // 校验：canonical category
    assertCanonicalCategory(snapshot.category);

    // 校验：expectedHash 与 DB 当前 hash 一致性
    if (expectedHash !== undefined) {
      const existing = await this.repo.get(snapshot.strategy);
      if (existing && existing.hash !== expectedHash) {
        throw new ConfigHashConflictError(
          expectedHash,
          existing.hash ?? '',
          existing,
        );
      }
    }

    // 持久化
    await this.repo.save(snapshot);

    return {
      ...snapshot,
      hash: snapshot.hash ?? '',
      updatedAt: Date.now(),
    };
  }

  // ─── 向后兼容方法（供旧路由 config.ts 使用，story-9 后移除） ────────

  /** @deprecated 使用 getOrDefault 替代 */
  async getConfig(strategy: string): Promise<ConfigSnapshot | null> {
    const result = await this.getOrDefault(strategy, '');
    return result.persisted ? result.configSnapshot : null;
  }

  /** @deprecated 使用 save(snapshot, expectedHash?) 替代 */
  async saveConfig(strategy: string, configJson: Record<string, unknown>, hash: string): Promise<void> {
    await this.save({ strategy, params: configJson, hash });
  }
}

// Fastify 实例类型扩展，使路由可通过 app.configService 访问
declare module 'fastify' {
  interface FastifyInstance {
    configService: StrategyConfigService;
  }
}
