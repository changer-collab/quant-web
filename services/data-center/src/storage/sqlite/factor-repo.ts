import { eq } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { factorDefinitions } from '../schema.js';
import type { FactorDefinition } from '../../repository/types.js';

export class SqliteFactorRepository {
  constructor(private db: DrizzleDb) {}

  async save(factor: FactorDefinition): Promise<void> {
    const now = Date.now();
    await this.db.insert(factorDefinitions).values({
      id: factor.id,
      name: factor.name,
      formula: factor.formula,
      category: factor.category,
      modes: JSON.stringify(factor.modes),
      frequency: factor.frequency,
      status: factor.status,
      version: factor.version,
      createdAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: factorDefinitions.id,
      set: {
        name: factor.name,
        formula: factor.formula,
        category: factor.category,
        modes: JSON.stringify(factor.modes),
        frequency: factor.frequency,
        status: factor.status,
        version: factor.version,
        updatedAt: now,
      },
    });
  }

  async getAll(): Promise<FactorDefinition[]> {
    const rows = await this.db.select().from(factorDefinitions);
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      formula: row.formula,
      category: row.category,
      modes: JSON.parse(row.modes),
      frequency: row.frequency,
      status: row.status,
      version: row.version,
    }));
  }

  async getById(id: string): Promise<FactorDefinition | undefined> {
    const rows = await this.db.select().from(factorDefinitions)
      .where(eq(factorDefinitions.id, id))
      .limit(1);
    
    if (rows.length === 0) return undefined;
    
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      formula: row.formula,
      category: row.category,
      modes: JSON.parse(row.modes),
      frequency: row.frequency,
      status: row.status,
      version: row.version,
    };
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(factorDefinitions).where(eq(factorDefinitions.id, id));
  }
}
