import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useTasks } from '../src/hooks/useTasks';

type MessageHandler = (event: { data: string }) => void;
type ErrorHandler = () => void;

class MockEventSource {
  static instances: MockEventSource[] = [];

  onmessage: MessageHandler | null = null;
  onerror: ErrorHandler | null = null;
  close = vi.fn();

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  emit(event: unknown) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }

  fail() {
    this.onerror?.();
  }
}

describe('useTasks', () => {
  afterEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    vi.unstubAllGlobals();
  });

  it('does not report an SSE error after a terminal result event', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    vi.stubGlobal('EventSource', MockEventSource);

    const events: unknown[] = [];
    const { result } = renderHook(() => useTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.submitAndStream('task-1', (event) => events.push(event));
    });

    const source = MockEventSource.instances[0];
    expect(source.url).toBe('/api/tasks/task-1/stream');

    act(() => {
      source.emit({ type: 'result', taskId: 'task-1', data: { ok: true } });
      source.fail();
    });

    expect(events).toEqual([{ type: 'result', taskId: 'task-1', data: { ok: true } }]);
  });
});
