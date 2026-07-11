import { apiGet, apiPost, apiPut } from './client';

export type ResearchSessionStatus =
  | 'collecting'
  | 'pending_review'
  | 'raw_published'
  | 'wiki_pending_review'
  | 'completed';

export interface ResearchCandidate {
  goal: string;
  initialHypothesis: string;
  implementationChanges: string;
  experiments: string;
  currentConclusion: string;
  failedAttempts: string;
  learnings: string;
  openQuestions: string;
}

export interface ResearchSession {
  id: string;
  strategy: string;
  title: string;
  status: ResearchSessionStatus;
  candidate: ResearchCandidate;
  createdAt: number;
  updatedAt: number;
}

export interface ResearchEvent {
  id: string;
  sessionId?: string;
  eventType: string;
  dedupeKey: string;
  payload: Record<string, unknown>;
  occurredAt: number;
}

export interface ResearchSessionDetail {
  session: ResearchSession;
  events: ResearchEvent[];
}

export function fetchResearchSessions(): Promise<ResearchSession[]> {
  return apiGet<ResearchSession[]>('/research/sessions');
}

export function fetchResearchSession(id: string): Promise<ResearchSessionDetail> {
  return apiGet<ResearchSessionDetail>(`/research/sessions/${id}`);
}

export function fetchUnassignedResearchEvents(): Promise<ResearchEvent[]> {
  return apiGet<ResearchEvent[]>('/research/events/unassigned');
}

export function addManualInspiration(input: {
  strategy: string;
  title?: string;
  content: string;
}): Promise<{ session: ResearchSession; event: ResearchEvent }> {
  return apiPost('/research/sessions/manual-inspiration', input);
}

export function updateResearchSession(
  id: string,
  update: { title?: string; candidate?: ResearchCandidate }
): Promise<ResearchSession> {
  return apiPut<ResearchSession>(`/research/sessions/${id}`, update);
}

export function finishResearchSession(id: string): Promise<ResearchSession> {
  return apiPost<ResearchSession>(`/research/sessions/${id}/finish`);
}

export function excludeResearchEvent(sessionId: string, eventId: string): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>(`/research/sessions/${sessionId}/events/${eventId}/exclude`);
}

export function assignResearchEvent(sessionId: string, eventId: string): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>(`/research/sessions/${sessionId}/events/${eventId}/assign`);
}
