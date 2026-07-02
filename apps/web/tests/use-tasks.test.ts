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

  it('SSE result 事件顶层带 resultType=diagnostics 时正确透传', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    vi.stubGlobal('EventSource', MockEventSource);

    const events: unknown[] = [];
    const { result } = renderHook(() => useTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.submitAndStream('diag-task', (event) => events.push(event));
    });

    const source = MockEventSource.instances[0];
    act(() => {
      source.emit({
        type: 'result',
        taskId: 'diag-task',
        resultId: 'diag-result-1',
        resultType: 'diagnostics',
        data: { diagnostics: { type: 'factor_based' } },
      });
    });

    expect(events).toHaveLength(1);
    const ev = events[0] as {
      resultId?: string;
      resultType?: string;
      data?: Record<string, unknown>;
    };
    expect(ev.resultId).toBe('diag-result-1');
    expect(ev.resultType).toBe('diagnostics');
    expect(ev.data).toBeDefined();
  });

  it('缺 resultType 的旧任务 SSE 事件不崩溃', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    vi.stubGlobal('EventSource', MockEventSource);

    const events: unknown[] = [];
    const { result } = renderHook(() => useTasks());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    act(() => {
      result.current.submitAndStream('old-task', (event) => events.push(event));
    });

    const source = MockEventSource.instances[0];
    act(() => {
      // 旧任务不携带 resultType / resultId（与重构前一致）
      source.emit({
        type: 'result',
        taskId: 'old-task',
        data: { backtestResult: { metrics: { totalReturn: 0.1 } } },
      });
    });

    expect(events).toHaveLength(1);
    const ev = events[0] as { resultType?: string; resultId?: string };
    expect(ev.resultType).toBeUndefined();
    expect(ev.resultId).toBeUndefined();
  });
});
