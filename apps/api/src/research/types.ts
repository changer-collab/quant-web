export const ResearchSessionStatus = {
  Collecting: 'collecting',
  PendingReview: 'pending_review',
  RawPublished: 'raw_published',
  WikiPendingReview: 'wiki_pending_review',
  Completed: 'completed',
} as const;

export type ResearchSessionStatus =
  (typeof ResearchSessionStatus)[keyof typeof ResearchSessionStatus];

export type ResearchEventType =
  | 'git_commit'
  | 'backtest_submitted'
  | 'backtest_completed'
  | 'manual_inspiration';

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
  rawPath?: string;
  rawPublishedAt?: number;
}

export interface ResearchEvent {
  id: string;
  sessionId?: string;
  eventType: ResearchEventType;
  dedupeKey: string;
  payload: Record<string, unknown>;
  occurredAt: number;
}

export interface ResearchCollectorState {
  source: string;
  lastValue: string;
  updatedAt: number;
}

export interface CreateResearchEventInput {
  sessionId?: string;
  eventType: ResearchEventType;
  dedupeKey: string;
  payload: Record<string, unknown>;
  occurredAt: number;
}

export interface CreateManualInspirationInput {
  strategy: string;
  title?: string;
  content: string;
}

export function createEmptyCandidate(initialHypothesis = ''): ResearchCandidate {
  return {
    goal: '',
    initialHypothesis,
    implementationChanges: '',
    experiments: '',
    currentConclusion: '',
    failedAttempts: '',
    learnings: '',
    openQuestions: '',
  };
}
