import { useEffect, useRef, useCallback, useState } from 'react';
import { streamTask, type TaskStreamEvent } from '../api/tasks';

export interface TaskStreamState {
  progress: number;
  lines: string[];
  status: string;
  result?: Record<string, unknown>;
  error?: { code: string; message: string };
}

const INITIAL_STATE: TaskStreamState = {
  progress: 0,
  lines: [],
  status: 'pending',
};

export function useTaskStream(taskId: string | null) {
  const [state, setState] = useState<TaskStreamState>(INITIAL_STATE);
  const closeRef = useRef<(() => void) | null>(null);

  const close = useCallback(() => {
    closeRef.current?.();
    closeRef.current = null;
  }, []);

  useEffect(() => {
    if (!taskId) return;

    setState(INITIAL_STATE);
    closeRef.current = streamTask(
      taskId,
      (event: TaskStreamEvent) => {
        setState((prev) => {
          switch (event.type) {
            case 'progress':
              return { ...prev, progress: event.percent ?? prev.progress };
            case 'log':
              return { ...prev, lines: [...prev.lines, `[${event.level ?? 'info'}] ${event.message ?? ''}`] };
            case 'status':
              return { ...prev, status: event.message ?? prev.status };
            case 'result':
              return { ...prev, status: 'completed', result: event.data, progress: 100 };
            case 'error':
              return { ...prev, status: 'failed', error: event.error };
            default:
              return prev;
          }
        });
      },
      () => {
        setState((prev) => ({ ...prev, status: 'failed' }));
      },
    );

    return () => {
      close();
    };
  }, [taskId, close]);

  return { ...state, close };
}
