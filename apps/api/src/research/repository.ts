import { asc, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { ApiDb } from '../storage/connection.js';
import { flushApiDb } from '../storage/connection.js';
import { researchCollectorStates, researchEvents, researchSessions } from '../storage/schema.js';
import type {
  ResearchCollectorState,
  ResearchEvent,
  ResearchSession,
} from './types.js';

export interface ResearchRepository {
  createSession(session: ResearchSession): Promise<void>;
  saveSession(session: ResearchSession): Promise<void>;
  getSession(id: string): Promise<ResearchSession | null>;
  listSessions(): Promise<ResearchSession[]>;
  findCollectingSession(strategy: string): Promise<ResearchSession | null>;
  saveEvent(event: ResearchEvent): Promise<{ created: boolean; event: ResearchEvent }>;
  findEventByDedupeKey(dedupeKey: string): Promise<ResearchEvent | null>;
  updateEvent(event: ResearchEvent): Promise<void>;
  getEvent(id: string): Promise<ResearchEvent | null>;
  listEvents(sessionId?: string): Promise<ResearchEvent[]>;
  getCollectorState(source: string): Promise<ResearchCollectorState | null>;
  saveCollectorState(state: ResearchCollectorState): Promise<void>;
}

export class InMemoryResearchRepository implements ResearchRepository {
  private readonly sessions = new Map<string, ResearchSession>();
  private readonly events = new Map<string, ResearchEvent>();
  private readonly eventsByDedupeKey = new Map<string, string>();
  private readonly collectorStates = new Map<string, ResearchCollectorState>();

  async createSession(session: ResearchSession): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async saveSession(session: ResearchSession): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async getSession(id: string): Promise<ResearchSession | null> {
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : null;
  }

  async listSessions(): Promise<ResearchSession[]> {
    return [...this.sessions.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((session) => structuredClone(session));
  }

  async findCollectingSession(strategy: string): Promise<ResearchSession | null> {
    const session = [...this.sessions.values()].find(
      (item) => item.strategy === strategy && item.status === 'collecting'
    );
    return session ? structuredClone(session) : null;
  }

  async saveEvent(event: ResearchEvent): Promise<{ created: boolean; event: ResearchEvent }> {
    const existingId = this.eventsByDedupeKey.get(event.dedupeKey);
    if (existingId) return { created: false, event: structuredClone(this.events.get(existingId)!) };
    this.events.set(event.id, structuredClone(event));
    this.eventsByDedupeKey.set(event.dedupeKey, event.id);
    return { created: true, event: structuredClone(event) };
  }

  async findEventByDedupeKey(dedupeKey: string): Promise<ResearchEvent | null> {
    const id = this.eventsByDedupeKey.get(dedupeKey);
    return id ? structuredClone(this.events.get(id)!) : null;
  }

  async getEvent(id: string): Promise<ResearchEvent | null> {
    const event = this.events.get(id);
    return event ? structuredClone(event) : null;
  }

  async updateEvent(event: ResearchEvent): Promise<void> {
    this.events.set(event.id, structuredClone(event));
  }

  async listEvents(sessionId?: string): Promise<ResearchEvent[]> {
    return [...this.events.values()]
      .filter((event) => (sessionId === undefined ? event.sessionId === undefined : event.sessionId === sessionId))
      .sort((a, b) => a.occurredAt - b.occurredAt)
      .map((event) => structuredClone(event));
  }

  async getCollectorState(source: string): Promise<ResearchCollectorState | null> {
    const state = this.collectorStates.get(source);
    return state ? structuredClone(state) : null;
  }

  async saveCollectorState(state: ResearchCollectorState): Promise<void> {
    this.collectorStates.set(state.source, structuredClone(state));
  }
}

export class SqliteResearchRepository implements ResearchRepository {
  constructor(private readonly db: ApiDb) {}

  async createSession(session: ResearchSession): Promise<void> {
    await this.db.insert(researchSessions).values(toSessionRow(session)).run();
    flushApiDb();
  }

  async saveSession(session: ResearchSession): Promise<void> {
    await this.db
      .update(researchSessions)
      .set(toSessionRow(session))
      .where(eq(researchSessions.id, session.id))
      .run();
    flushApiDb();
  }

  async getSession(id: string): Promise<ResearchSession | null> {
    const rows = await this.db.select().from(researchSessions).where(eq(researchSessions.id, id)).limit(1);
    return rows[0] ? fromSessionRow(rows[0]) : null;
  }

  async listSessions(): Promise<ResearchSession[]> {
    const rows = await this.db.select().from(researchSessions).orderBy(desc(researchSessions.updatedAt));
    return rows.map(fromSessionRow);
  }

  async findCollectingSession(strategy: string): Promise<ResearchSession | null> {
    const rows = await this.db
      .select()
      .from(researchSessions)
      .where(eq(researchSessions.strategy, strategy))
      .orderBy(desc(researchSessions.updatedAt));
    const row = rows.find((item) => item.status === 'collecting');
    return row ? fromSessionRow(row) : null;
  }

  async saveEvent(event: ResearchEvent): Promise<{ created: boolean; event: ResearchEvent }> {
    const existing = await this.db
      .select()
      .from(researchEvents)
      .where(eq(researchEvents.dedupeKey, event.dedupeKey))
      .limit(1);
    if (existing[0]) return { created: false, event: fromEventRow(existing[0]) };

    await this.db.insert(researchEvents).values(toEventRow(event)).run();
    flushApiDb();
    return { created: true, event };
  }

  async findEventByDedupeKey(dedupeKey: string): Promise<ResearchEvent | null> {
    const rows = await this.db
      .select()
      .from(researchEvents)
      .where(eq(researchEvents.dedupeKey, dedupeKey))
      .limit(1);
    return rows[0] ? fromEventRow(rows[0]) : null;
  }

  async getEvent(id: string): Promise<ResearchEvent | null> {
    const rows = await this.db.select().from(researchEvents).where(eq(researchEvents.id, id)).limit(1);
    return rows[0] ? fromEventRow(rows[0]) : null;
  }

  async updateEvent(event: ResearchEvent): Promise<void> {
    await this.db
      .update(researchEvents)
      .set({ sessionId: event.sessionId ?? null })
      .where(eq(researchEvents.id, event.id))
      .run();
    flushApiDb();
  }

  async listEvents(sessionId?: string): Promise<ResearchEvent[]> {
    const rows = sessionId === undefined
      ? await this.db.select().from(researchEvents).orderBy(asc(researchEvents.occurredAt))
      : await this.db
          .select()
          .from(researchEvents)
          .where(eq(researchEvents.sessionId, sessionId))
          .orderBy(asc(researchEvents.occurredAt));
    return rows
      .filter((row) => (sessionId === undefined ? row.sessionId === null : true))
      .map(fromEventRow);
  }

  async getCollectorState(source: string): Promise<ResearchCollectorState | null> {
    const rows = await this.db
      .select()
      .from(researchCollectorStates)
      .where(eq(researchCollectorStates.source, source))
      .limit(1);
    return rows[0]
      ? { source: rows[0].source, lastValue: rows[0].lastValue, updatedAt: rows[0].updatedAt }
      : null;
  }

  async saveCollectorState(state: ResearchCollectorState): Promise<void> {
    await this.db
      .insert(researchCollectorStates)
      .values(state)
      .onConflictDoUpdate({
        target: researchCollectorStates.source,
        set: { lastValue: state.lastValue, updatedAt: state.updatedAt },
      })
      .run();
    flushApiDb();
  }
}

export function createResearchId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}

function toSessionRow(session: ResearchSession) {
  return {
    id: session.id,
    strategy: session.strategy,
    title: session.title,
    status: session.status,
    candidateJson: JSON.stringify(session.candidate),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    rawPath: session.rawPath ?? null,
    rawPublishedAt: session.rawPublishedAt ?? null,
  };
}

function fromSessionRow(row: typeof researchSessions.$inferSelect): ResearchSession {
  return {
    id: row.id,
    strategy: row.strategy,
    title: row.title,
    status: row.status as ResearchSession['status'],
    candidate: JSON.parse(row.candidateJson) as ResearchSession['candidate'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    rawPath: row.rawPath ?? undefined,
    rawPublishedAt: row.rawPublishedAt ?? undefined,
  };
}

function toEventRow(event: ResearchEvent) {
  return {
    id: event.id,
    sessionId: event.sessionId ?? null,
    eventType: event.eventType,
    dedupeKey: event.dedupeKey,
    payloadJson: JSON.stringify(event.payload),
    occurredAt: event.occurredAt,
  };
}

function fromEventRow(row: typeof researchEvents.$inferSelect): ResearchEvent {
  return {
    id: row.id,
    sessionId: row.sessionId ?? undefined,
    eventType: row.eventType as ResearchEvent['eventType'],
    dedupeKey: row.dedupeKey,
    payload: JSON.parse(row.payloadJson) as Record<string, unknown>,
    occurredAt: row.occurredAt,
  };
}
