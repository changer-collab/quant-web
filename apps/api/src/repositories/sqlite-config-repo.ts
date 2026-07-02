/**
 * SQLite 策略配置 Repository 实现
 *
 * SqliteConfigRepo —— 策略配置读写（含透明历史记录写入）
 * SqliteConfigHistoryRepo —— 配置变更历史记录
 */
import { eq, desc } from 'drizzle-orm';
import type { ApiDb } from '../storage/connection.js';
import type { IConfigRepo, IConfigHistoryRepo } from './interfaces.js';
import type { ConfigSnapshot } from '../types.js';
import { strategyConfigs, configHistory } from '../storage/schema.js';

export class SqliteConfigHistoryRepo implements IConfigHistoryRepo {
  constructor(private db: ApiDb) {}

  async append(snapshot: ConfigSnapshot): Promise<void> {
    await this.db
      .insert(configHistory)
      .values({
        strategy: snapshot.strategy,
        configJson: JSON.stringify(snapshot.params),
        hash: snapshot.hash ?? '',
        createdAt: Date.now(),
        strategyVersion: snapshot.strategyVersion ?? null,
        category: snapshot.category ?? null,
        subcategory: snapshot.subcategory ?? null,
        schemaVersion: snapshot.schemaVersion ?? null,
      })
      .run();
  }

  async list(
    strategy: string,
    limit = 20,
    offset = 0
  ): Promise<
    Array<{
      id: number;
      strategy: string;
      configJson: Record<string, unknown>;
      hash: string;
      createdAt: number;
      strategyVersion?: string;
      category?: string;
      subcategory?: string;
      schemaVersion?: number;
    }>
  > {
    const rows = await this.db
      .select()
      .from(configHistory)
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
      strategyVersion: r.strategyVersion ?? undefined,
      category: r.category ?? undefined,
      subcategory: r.subcategory ?? undefined,
      schemaVersion: r.schemaVersion ?? undefined,
    }));
  }
}

export class SqliteConfigRepo implements IConfigRepo {
  constructor(
    private db: ApiDb,
    private historyRepo: IConfigHistoryRepo
  ) {}

  async get(strategy: string): Promise<ConfigSnapshot | null> {
    const rows = await this.db
      .select()
      .from(strategyConfigs)
      .where(eq(strategyConfigs.strategy, strategy))
      .limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      strategy: row.strategy,
      schemaVersion: row.schemaVersion ?? 1,
      category: (row.category ?? 'non_factor') as ConfigSnapshot['category'],
      subcategory: row.subcategory ?? undefined,
      params: JSON.parse(row.configJson) as Record<string, unknown>,
      hash: row.hash,
      updatedAt: row.updatedAt,
    };
  }

  async save(snapshot: ConfigSnapshot): Promise<void> {
    const now = Date.now();
    const json = JSON.stringify(snapshot.params ?? {});
    await this.db
      .insert(strategyConfigs)
      .values({
        strategy: snapshot.strategy,
        configJson: json,
        hash: snapshot.hash ?? '',
        updatedAt: now,
        category: snapshot.category ?? 'non_factor',
        subcategory: snapshot.subcategory ?? null,
        schemaVersion: snapshot.schemaVersion ?? 1,
      })
      .onConflictDoUpdate({
        target: strategyConfigs.strategy,
        set: {
          configJson: json,
          hash: snapshot.hash ?? '',
          updatedAt: now,
          category: snapshot.category ?? 'non_factor',
          subcategory: snapshot.subcategory ?? null,
          schemaVersion: snapshot.schemaVersion ?? 1,
        },
      })
      .run();
    // 透明写入配置历史
    await this.historyRepo.append(snapshot);
  }
}
