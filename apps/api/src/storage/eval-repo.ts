import { eq, desc } from 'drizzle-orm';
import { getApiDb } from './connection.js';
import { factorEvaluations } from './schema.js';
import type { FactorEvaluation, FactorEvaluationSummary } from '../types.js';

type EvalRow = typeof factorEvaluations.$inferSelect;

function rowToSummary(row: EvalRow): FactorEvaluationSummary {
  return {
    id: row.id,
    factorId: row.factorId,
    taskId: row.taskId,
    createdAt: row.createdAt,
    icMean: row.icMean ?? undefined,
    icStd: row.icStd ?? undefined,
    rankIcMean: row.rankIcMean ?? undefined,
    rankIcStd: row.rankIcStd ?? undefined,
    icir: row.icir ?? undefined,
    rankIcir: row.rankIcir ?? undefined,
  };
}

function rowToEvaluation(row: EvalRow): FactorEvaluation {
  return {
    ...rowToSummary(row),
    groupReturns: row.groupReturns ? JSON.parse(row.groupReturns) : undefined,
    evalData: JSON.parse(row.evalData),
  };
}

export class FactorEvaluationRepository {
  async save(evaluation: FactorEvaluation): Promise<void> {
    const db = getApiDb();
    const row = {
      id: evaluation.id,
      factorId: evaluation.factorId,
      taskId: evaluation.taskId,
      createdAt: evaluation.createdAt,
      icMean: evaluation.icMean ?? null,
      icStd: evaluation.icStd ?? null,
      rankIcMean: evaluation.rankIcMean ?? null,
      rankIcStd: evaluation.rankIcStd ?? null,
      icir: evaluation.icir ?? null,
      rankIcir: evaluation.rankIcir ?? null,
      groupReturns: evaluation.groupReturns ? JSON.stringify(evaluation.groupReturns) : null,
      evalData: JSON.stringify(evaluation.evalData),
    };

    await db
      .insert(factorEvaluations)
      .values(row)
      .onConflictDoUpdate({
        target: factorEvaluations.id,
        set: row,
      })
      .execute();
  }

  async getById(id: string): Promise<FactorEvaluation | undefined> {
    const db = getApiDb();
    const rows = await db
      .select()
      .from(factorEvaluations)
      .where(eq(factorEvaluations.id, id))
      .execute();
    return rows[0] ? rowToEvaluation(rows[0]) : undefined;
  }

  async getByFactorId(factorId: string): Promise<FactorEvaluationSummary[]> {
    const db = getApiDb();
    const rows = await db
      .select()
      .from(factorEvaluations)
      .where(eq(factorEvaluations.factorId, factorId))
      .orderBy(desc(factorEvaluations.createdAt))
      .execute();
    return rows.map(rowToSummary);
  }

  async getLatestByFactorId(factorId: string): Promise<FactorEvaluation | undefined> {
    const db = getApiDb();
    const rows = await db
      .select()
      .from(factorEvaluations)
      .where(eq(factorEvaluations.factorId, factorId))
      .orderBy(desc(factorEvaluations.createdAt))
      .limit(1)
      .execute();
    return rows[0] ? rowToEvaluation(rows[0]) : undefined;
  }

  async delete(id: string): Promise<void> {
    const db = getApiDb();
    await db.delete(factorEvaluations).where(eq(factorEvaluations.id, id)).execute();
  }
}
