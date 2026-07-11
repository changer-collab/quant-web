import { createResearchId, type ResearchRepository } from './repository.js';
import {
  createEmptyCandidate,
  ResearchSessionStatus,
  type CreateManualInspirationInput,
  type CreateResearchEventInput,
  type ResearchCandidate,
  type ResearchEvent,
  type ResearchSession,
} from './types.js';

export class ResearchStateError extends Error {}

export class ResearchService {
  constructor(private readonly repository: ResearchRepository) {}

  async addManualInspiration(input: CreateManualInspirationInput): Promise<{ session: ResearchSession; event: ResearchEvent }> {
    const session = await this.getOrCreateCollectingSession(input.strategy, input.title, input.content);
    const now = Date.now();
    const event: ResearchEvent = {
      id: createResearchId('re'),
      sessionId: session.id,
      eventType: 'manual_inspiration',
      dedupeKey: `manual_inspiration:${createResearchId('mi')}`,
      payload: { content: input.content },
      occurredAt: now,
    };
    await this.repository.saveEvent(event);
    return { session, event };
  }

  async ingestEvent(input: CreateResearchEventInput): Promise<{ created: boolean; event: ResearchEvent }> {
    const existing = await this.repository.findEventByDedupeKey(input.dedupeKey);
    if (existing) return { created: false, event: existing };

    let sessionId = input.sessionId;
    if (!sessionId) {
      const strategy = input.payload.strategy;
      if (typeof strategy === 'string' && strategy) {
        sessionId = (await this.getOrCreateCollectingSession(strategy)).id;
      }
    }

    const result = await this.repository.saveEvent({
      id: createResearchId('re'),
      sessionId,
      eventType: input.eventType,
      dedupeKey: input.dedupeKey,
      payload: input.payload,
      occurredAt: input.occurredAt,
    });
    return result;
  }

  async listSessions(): Promise<ResearchSession[]> {
    return this.repository.listSessions();
  }

  async getSessionDetail(id: string): Promise<{ session: ResearchSession; events: ResearchEvent[] } | null> {
    const session = await this.repository.getSession(id);
    if (!session) return null;
    return { session, events: await this.repository.listEvents(id) };
  }

  async updateSession(id: string, update: { title?: string; candidate?: ResearchCandidate }): Promise<ResearchSession> {
    const session = await this.requireSession(id);
    if (
      session.status !== ResearchSessionStatus.Collecting &&
      session.status !== ResearchSessionStatus.PendingReview
    ) {
      throw new ResearchStateError('Raw 发布后不能再编辑研究候选');
    }
    const next = {
      ...session,
      title: update.title?.trim() || session.title,
      candidate: update.candidate ?? session.candidate,
      updatedAt: Date.now(),
    };
    await this.repository.saveSession(next);
    return next;
  }

  async finishSession(id: string): Promise<ResearchSession> {
    const session = await this.requireSession(id);
    if (session.status !== ResearchSessionStatus.Collecting) {
      throw new ResearchStateError('只有 collecting 状态可以结束研究');
    }
    const next = { ...session, status: ResearchSessionStatus.PendingReview, updatedAt: Date.now() };
    await this.repository.saveSession(next);
    return next;
  }

  async excludeEvent(sessionId: string, eventId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (
      session.status !== ResearchSessionStatus.Collecting &&
      session.status !== ResearchSessionStatus.PendingReview
    ) {
      throw new ResearchStateError('Raw 发布后不能再排除研究事件');
    }
    const event = await this.repository.getEvent(eventId);
    if (!event || event.sessionId !== sessionId) throw new Error('研究事件不存在');
    await this.repository.updateEvent({ ...event, sessionId: undefined });
  }

  async assignEvent(sessionId: string, eventId: string): Promise<void> {
    const session = await this.requireSession(sessionId);
    if (
      session.status !== ResearchSessionStatus.Collecting &&
      session.status !== ResearchSessionStatus.PendingReview
    ) {
      throw new ResearchStateError('Raw 发布后不能再归类研究事件');
    }
    const event = await this.repository.getEvent(eventId);
    if (!event || event.sessionId) throw new Error('待归类研究事件不存在');
    await this.repository.updateEvent({ ...event, sessionId });
  }

  async listUnassignedEvents(): Promise<ResearchEvent[]> {
    return this.repository.listEvents();
  }

  async getCollectorState(source: string) {
    return this.repository.getCollectorState(source);
  }

  async saveCollectorState(source: string, lastValue: string): Promise<void> {
    await this.repository.saveCollectorState({ source, lastValue, updatedAt: Date.now() });
  }

  private async getOrCreateCollectingSession(
    strategy: string,
    title?: string,
    initialHypothesis = ''
  ): Promise<ResearchSession> {
    const existing = await this.repository.findCollectingSession(strategy);
    if (existing) return existing;
    const now = Date.now();
    const session: ResearchSession = {
      id: createResearchId('rs'),
      strategy,
      title: title?.trim() || `${strategy} 研究过程`,
      status: ResearchSessionStatus.Collecting,
      candidate: createEmptyCandidate(initialHypothesis),
      createdAt: now,
      updatedAt: now,
    };
    await this.repository.createSession(session);
    return session;
  }

  private async requireSession(id: string): Promise<ResearchSession> {
    const session = await this.repository.getSession(id);
    if (!session) throw new Error('研究过程不存在');
    return session;
  }
}
