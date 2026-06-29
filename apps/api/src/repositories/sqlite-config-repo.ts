/**
 * SQLite 策略配置 Repository 实现
 *
 * SqliteConfigRepo —— 策略配置读写（含透明历史记录写入）
 * SqliteConfigHistoryRepo —— 配置变更历史记录
 */
import { eq, desc } from 'drizzle-orm';
import type { ApiDb } from '../storage/connection.js';
import type { IConfigRepo, IConfigHistoryRepo } from './interfaces.js';
import type { StrategyConfig } from '../types.js';
import { strategyConfigs, configHistory } from '../storage/schema.js';

export class SqliteConfigHistoryRepo implements IConfigHistoryRepo {
  constructor(private db: ApiDb) {}

  async append(strategy: string, configJson: Record<string, unknown>, hash: string): Promise<void> {
    await this.db.insert(configHistory).values({
      strategy,
      configJson: JSON.stringify(configJson),
      hash,
      createdAt: Date.now(),
    }).run();
  }

  async list(
    strategy: string,
    limit = 20,
    offset = 0,
  ): Promise<Array<{ id: number; strategy: string; configJson: Record<string, unknown>; hash: string; createdAt: number }>> {
    const rows = await this.db.select().from(configHistory)
      .where(eq(configHistory.strategy, strategy))
      .orderBy(desc(configHistory.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({
      id: r.id,
      strategy: r.strategy,
      configJson: JSON.parse(r.configJson) as Record<string, unknown>,
      hash: r.hash,
      createdAt: r.createdAt,
    }));
  }
}

export class SqliteConfigRepo implements IConfigRepo {
  constructor(
    private db: ApiDb,
    private historyRepo: IConfigHistoryRepo,
  ) {}

  async get(strategy: string): Promise<StrategyConfig | null> {
    const rows = await this.db.select().from(strategyConfigs)
      .where(eq(strategyConfigs.strategy, strategy))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      config_json: JSON.parse(row.configJson) as Record<string, unknown>,
      hash: row.hash,
      updated_at: row.updatedAt,
    };
  }

  async save(strategy: string, configJson: Record<string, unknown>, hash: string): Promise<void> {
    const now = Date.now();
    const json = JSON.stringify(configJson);
    await this.db.insert(strategyConfigs).values({
      strategy,
      configJson: json,
      hash,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: strategyConfigs.strategy,
      set: { configJson: json, hash, updatedAt: now },
    }).run();
    // 透明写入配置历史
    await this.historyRepo.append(strategy, configJson, hash);
  }
}
