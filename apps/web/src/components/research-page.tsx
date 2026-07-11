import { useCallback, useMemo, useState } from 'react';
import type { ResearchCandidate, ResearchEvent, ResearchSessionDetail } from '../api/research';
import { useResearchSessions } from '../hooks/useResearchSessions';
import type { ResearchCopy } from '../appData';
import styles from '../styles/research-page.module.css';

interface ResearchPageProps {
  copy: ResearchCopy;
}

const candidateFields: Array<keyof ResearchCandidate> = [
  'goal',
  'initialHypothesis',
  'implementationChanges',
  'experiments',
  'currentConclusion',
  'failedAttempts',
  'learnings',
  'openQuestions',
];

function getEventSummary(event: ResearchEvent): string {
  const message = event.payload.message;
  if (typeof message === 'string' && message) return message;
  const content = event.payload.content;
  if (typeof content === 'string' && content) return content;
  const taskId = event.payload.taskId;
  if (typeof taskId === 'string' && taskId) return `${event.eventType} · ${taskId}`;
  return event.eventType;
}

export function ResearchPage({ copy }: ResearchPageProps) {
  const { sessions, unassignedEvents, loading, getDetail, save, finish, addIdea, exclude, assign } =
    useResearchSessions();
  const [selected, setSelected] = useState<ResearchSessionDetail | null>(null);
  const [strategy, setStrategy] = useState('');
  const [idea, setIdea] = useState('');
  const [error, setError] = useState('');

  const selectSession = useCallback(
    async (id: string): Promise<void> => {
      try {
        setSelected(await getDetail(id));
        setError('');
      } catch {
        setError(copy.saveFailed);
      }
    },
    [copy.saveFailed, getDetail]
  );

  const labels = useMemo(
    () => ({
      goal: copy.goal,
      initialHypothesis: copy.initialHypothesis,
      implementationChanges: copy.implementationChanges,
      experiments: copy.experiments,
      currentConclusion: copy.currentConclusion,
      failedAttempts: copy.failedAttempts,
      learnings: copy.learnings,
      openQuestions: copy.openQuestions,
    }),
    [copy]
  );
  const candidateEditable =
    selected?.session.status === 'collecting' || selected?.session.status === 'pending_review';

  async function handleAddIdea(): Promise<void> {
    if (!strategy.trim() || !idea.trim()) return;
    try {
      const session = await addIdea({ strategy, content: idea });
      await selectSession(session.id);
      setIdea('');
      setError('');
    } catch {
      setError(copy.saveFailed);
    }
  }

  async function handleSave(): Promise<void> {
    if (!selected) return;
    try {
      const session = await save(selected.session.id, {
        title: selected.session.title,
        candidate: selected.session.candidate,
      });
      setSelected((current) => (current ? { ...current, session } : current));
      setError('');
    } catch {
      setError(copy.saveFailed);
    }
  }

  async function handleFinish(): Promise<void> {
    if (!selected) return;
    try {
      const session = await finish(selected.session.id);
      setSelected((current) => (current ? { ...current, session } : current));
      setError('');
    } catch {
      setError(copy.saveFailed);
    }
  }

  async function handleExclude(eventId: string): Promise<void> {
    if (!selected) return;
    try {
      await exclude(selected.session.id, eventId);
      await selectSession(selected.session.id);
      setError('');
    } catch {
      setError(copy.saveFailed);
    }
  }

  async function handleAssign(eventId: string): Promise<void> {
    if (!selected || !candidateEditable) return;
    try {
      await assign(selected.session.id, eventId);
      await selectSession(selected.session.id);
      setError('');
    } catch {
      setError(copy.saveFailed);
    }
  }

  function updateCandidate(field: keyof ResearchCandidate, value: string): void {
    setSelected((current) =>
      current
        ? { ...current, session: { ...current.session, candidate: { ...current.session.candidate, [field]: value } } }
        : current
    );
  }

  if (loading) return <p className={styles.empty}>{copy.empty}</p>;

  return (
    <div className={styles.layout}>
      <section className={styles.sessions}>
        <h2>{copy.sessions}</h2>
        {sessions.length === 0 ? <p className={styles.empty}>{copy.empty}</p> : null}
        {sessions.map((session) => (
          <button
            className={selected?.session.id === session.id ? styles.sessionActive : styles.session}
            key={session.id}
            onClick={() => void selectSession(session.id)}
            type="button"
          >
            <strong>{session.title}</strong>
            <small>{session.status}</small>
          </button>
        ))}
        <h3>{copy.addInspiration}</h3>
        <label>
          {copy.strategy}
          <input onChange={(event) => setStrategy(event.target.value)} value={strategy} />
        </label>
        <label>
          {copy.inspiration}
          <textarea onChange={(event) => setIdea(event.target.value)} value={idea} />
        </label>
        <button onClick={() => void handleAddIdea()} type="button">
          {copy.addInspiration}
        </button>
        <h3>{copy.unassigned}</h3>
        <ul className={styles.timeline}>
          {unassignedEvents.map((event) => (
            <li key={event.id}>
              <span>{getEventSummary(event)}</span>
              {candidateEditable ? (
                <button onClick={() => void handleAssign(event.id)} type="button">
                  {copy.assign}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.detail}>
        {selected ? (
          <>
            <label>
              {copy.title}
              <input
                disabled={!candidateEditable}
                onChange={(event) =>
                  setSelected((current) =>
                    current ? { ...current, session: { ...current.session, title: event.target.value } } : current
                  )
                }
                value={selected.session.title}
              />
            </label>
            <h2>{copy.candidate}</h2>
            {candidateFields.map((field) => (
              <label key={field}>
                {labels[field]}
                <textarea
                  disabled={!candidateEditable}
                  onChange={(event) => updateCandidate(field, event.target.value)}
                  value={selected.session.candidate[field]}
                />
              </label>
            ))}
            {candidateEditable ? (
              <div className={styles.actions}>
                <button onClick={() => void handleSave()} type="button">
                  {copy.save}
                </button>
                {selected.session.status === 'collecting' ? (
                  <button onClick={() => void handleFinish()} type="button">
                    {copy.finish}
                  </button>
                ) : null}
              </div>
            ) : null}
            <h2>{copy.timeline}</h2>
            <ul className={styles.timeline}>
              {selected.events.map((event) => (
                <li key={event.id}>
                  <span>{getEventSummary(event)}</span>
                  {candidateEditable ? (
                    <button onClick={() => void handleExclude(event.id)} type="button">
                      {copy.exclude}
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.empty}>{copy.empty}</p>
        )}
        {error ? <p className={styles.error}>{error}</p> : null}
      </section>
    </div>
  );
}
