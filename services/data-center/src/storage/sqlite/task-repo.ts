import { eq, and } from 'drizzle-orm';
import type { DrizzleDb } from './connection.js';
import { tasks } from '../schema.js';

export interface TaskView {
  id: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
  progress?: number;
  lines?: string[];
}

export class SqliteTaskRepository {
  constructor(private db: DrizzleDb) {}

  async save(task: TaskView): Promise<void> {
    await this.db
      .insert(tasks)
      .values({
        id: task.id,
        type: task.type,
        status: task.status,
        payload: JSON.stringify(task.payload),
        submittedAt: task.submittedAt,
        startedAt: task.startedAt ?? null,
        completedAt: task.completedAt ?? null,
        result: task.result ? JSON.stringify(task.result) : null,
        error: task.error ?? null,
        progress: task.progress ?? null,
        lines: task.lines ? JSON.stringify(task.lines) : null,
      })
      .onConflictDoUpdate({
        target: tasks.id,
        set: {
          status: task.status,
          startedAt: task.startedAt ?? null,
          completedAt: task.completedAt ?? null,
          result: task.result ? JSON.stringify(task.result) : null,
          error: task.error ?? null,
          progress: task.progress ?? null,
          lines: task.lines ? JSON.stringify(task.lines) : null,
        },
      });
  }

  async getById(id: string): Promise<TaskView | undefined> {
    const rows = await this.db.select().from(tasks).where(eq(tasks.id, id)).limit(1);

    if (rows.length === 0) return undefined;

    return this.mapRow(rows[0]);
  }

  async list(filter?: { type?: string; status?: string }): Promise<TaskView[]> {
    const conditions = [];
    if (filter?.type) conditions.push(eq(tasks.type, filter.type));
    if (filter?.status) conditions.push(eq(tasks.status, filter.status));

    const rows = await this.db
      .select()
      .from(tasks)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return rows.map((row) => this.mapRow(row));
  }

  private mapRow(row: typeof tasks.$inferSelect): TaskView {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      payload: JSON.parse(row.payload),
      submittedAt: row.submittedAt,
      startedAt: row.startedAt ?? undefined,
      completedAt: row.completedAt ?? undefined,
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error ?? undefined,
      progress: row.progress ?? undefined,
      lines: row.lines ? JSON.parse(row.lines) : undefined,
    };
  }
}
