import { apiGet, apiPost } from './client';

export type ApiTaskType = 'backtest' | 'factor_compute' | 'factor_eval' | 'ai_train';
export type ApiTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ApiTask {
  id: string;
  type: ApiTaskType;
  status: ApiTaskStatus;
  payload: Record<string, unknown>;
  submittedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: Record<string, unknown>;
  error?: string;
  progress?: number;
  lines?: string[];
}

/** SSE 任务事件 */
export interface TaskStreamEvent {
  type: 'progress' | 'log' | 'status' | 'result' | 'error';
  taskId: string;
  percent?: number;
  message?: string;
  level?: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string };
}

export function fetchTasks(type?: ApiTaskType): Promise<ApiTask[]> {
  const query = type ? `?type=${type}` : '';
  return apiGet<ApiTask[]>(`/tasks${query}`);
}

export function fetchTask(id: string): Promise<ApiTask> {
  return apiGet<ApiTask>(`/tasks/${id}`);
}

export function submitBacktest(payload: {
  strategy: string;
  symbol: string;
  timeframe: string;
  initialCash?: number;
  slippage?: number;
  startTs?: number;
  endTs?: number;
  params?: Record<string, unknown>;
}): Promise<{ id: string; status: ApiTaskStatus }> {
  return apiPost('/tasks', { type: 'backtest', payload });
}

export function submitFactorEval(factorId: string, symbol?: string): Promise<{ taskId: string; status: ApiTaskStatus }> {
  return apiPost(`/factors/${factorId}/evaluate`, { symbol });
}

/** 打开 SSE 连接，返回关闭函数 */
export function streamTask(
  taskId: string,
  onEvent: (event: TaskStreamEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource(`/api/tasks/${taskId}/stream`);
  let terminalEventReceived = false;

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as TaskStreamEvent;
      if (event.type === 'result' || event.type === 'error') {
        terminalEventReceived = true;
      }
      onEvent(event);
      if (terminalEventReceived) {
        es.close();
      }
    } catch {
      // 忽略解析错误
    }
  };
  es.onerror = () => {
    es.close();
    if (!terminalEventReceived) {
      onError?.(new Event('error'));
    }
  };
  return () => es.close();
}
