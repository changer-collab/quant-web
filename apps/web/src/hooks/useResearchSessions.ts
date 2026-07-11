import { useCallback, useEffect, useState } from 'react';
import {
  addManualInspiration,
  assignResearchEvent,
  excludeResearchEvent,
  fetchResearchSession,
  fetchResearchSessions,
  fetchUnassignedResearchEvents,
  finishResearchSession,
  updateResearchSession,
  type ResearchCandidate,
  type ResearchEvent,
  type ResearchSession,
  type ResearchSessionDetail,
} from '../api/research';

export function useResearchSessions() {
  const [sessions, setSessions] = useState<ResearchSession[]>([]);
  const [unassignedEvents, setUnassignedEvents] = useState<ResearchEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async (): Promise<void> => {
    const [nextSessions, nextUnassigned] = await Promise.all([
      fetchResearchSessions(),
      fetchUnassignedResearchEvents(),
    ]);
    setSessions(nextSessions);
    setUnassignedEvents(nextUnassigned);
  }, []);

  useEffect(() => {
    void reload().finally(() => setLoading(false));
  }, [reload]);

  const getDetail = useCallback(async (id: string): Promise<ResearchSessionDetail> => {
    return fetchResearchSession(id);
  }, []);

  const save = useCallback(
    async (id: string, update: { title?: string; candidate?: ResearchCandidate }): Promise<ResearchSession> => {
      const session = await updateResearchSession(id, update);
      await reload();
      return session;
    },
    [reload]
  );

  const finish = useCallback(
    async (id: string): Promise<ResearchSession> => {
      const session = await finishResearchSession(id);
      await reload();
      return session;
    },
    [reload]
  );

  const addIdea = useCallback(
    async (input: { strategy: string; title?: string; content: string }): Promise<ResearchSession> => {
      const result = await addManualInspiration(input);
      await reload();
      return result.session;
    },
    [reload]
  );

  const exclude = useCallback(
    async (sessionId: string, eventId: string): Promise<void> => {
      await excludeResearchEvent(sessionId, eventId);
      await reload();
    },
    [reload]
  );

  const assign = useCallback(
    async (sessionId: string, eventId: string): Promise<void> => {
      await assignResearchEvent(sessionId, eventId);
      await reload();
    },
    [reload]
  );

  return { sessions, unassignedEvents, loading, reload, getDetail, save, finish, addIdea, exclude, assign };
}
