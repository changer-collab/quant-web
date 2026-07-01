/**
 * SQLite 诊断结果 Repository 实现
 *
 * SqliteDiagnosticRepo —— 诊断结果 CRUD + 过期清理
 */
import { eq, lt, desc, sql } from 'drizzle-orm';
import type { ApiDb } from '../storage/connection.js';
import type { IDiagnosticRepo } from './interfaces.js';
import type { DiagnosticResult } from '../types.js';
import { diagnosticResults } from '../storage/schema.js';

export class SqliteDiagnosticRepo implements IDiagnosticRepo {
  constructor(private db: ApiDb) {}

  async save(result: DiagnosticResult): Promise<void> {
    await this.db.insert(diagnosticResults).values({
      id: result.id,
      taskId: result.taskId,
      strategy: result.strategy,
      category: result.category,
      subcategory: result.subcategory,
      configSnapshot: JSON.stringify(result.configSnapshot),
      dataJson: JSON.stringify(result.dataJson),
      createdAt: result.createdAt,
      engineVersion: result.engineVersion,
      expiresAt: result.expiresAt,
    }).run();
  }

  async getById(id: string): Promise<DiagnosticResult | null> {
    const rows = await this.db.select().from(diagnosticResults)
      .where(eq(diagnosticResults.id, id))
      .limit(1);
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      taskId: r.taskId,
      strategy: r.strategy,
      category: r.category as DiagnosticResult['category'],
      subcategory: r.subcategory ?? null,
      configSnapshot: JSON.parse(r.configSnapshot) as DiagnosticResult['configSnapshot'],
      dataJson: JSON.parse(r.dataJson) as Record<string, unknown>,
      createdAt: r.createdAt,
      engineVersion: r.engineVersion ?? 'legacy',
      expiresAt: r.expiresAt ?? r.createdAt + 7 * 24 * 60 * 60 * 1000,
    };
  }

  async listByStrategy(strategy: string, limit = 20): Promise<DiagnosticResult[]> {
    const rows = await this.db.select().from(diagnosticResults)
      .where(eq(diagnosticResults.strategy, strategy))
      .orderBy(desc(diagnosticResults.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      taskId: r.taskId,
      strategy: r.strategy,
      category: r.category as DiagnosticResult['category'],
      subcategory: r.subcategory ?? null,
      configSnapshot: JSON.parse(r.configSnapshot) as DiagnosticResult['configSnapshot'],
      dataJson: JSON.parse(r.dataJson) as Record<string, unknown>,
      createdAt: r.createdAt,
      engineVersion: r.engineVersion ?? 'legacy',
      expiresAt: r.expiresAt ?? r.createdAt + 7 * 24 * 60 * 60 * 1000,
    }));
  }

  async purgeOlderThan(days: number): Promise<number> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    await this.db.delete(diagnosticResults)
      .where(lt(diagnosticResults.createdAt, cutoff))
      .run();
    return 0; // SQL.js 驱动不返回 affected rows count
  }
}
