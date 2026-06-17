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
  symbol?: string;
  timeframe?: string;
  initialCash?: number;
  slippage?: number;
  params?: Record<string, unknown>;
}): Promise<{ id: string; status: ApiTaskStatus }> {
  return apiPost('/tasks', { type: 'backtest', payload });
}

export function submitFactorEval(factorId: string, symbol?: string): Promise<{ taskId: string; status: ApiTaskStatus }> {
  return apiPost(`/factors/${factorId}/evaluate`, { symbol });
}
