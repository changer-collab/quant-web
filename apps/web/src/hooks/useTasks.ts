import { useCallback } from 'react';
import { useApi } from './useApi';
import {
  fetchTasks,
  fetchTask,
  submitBacktest,
  type ApiTask,
} from '../api/tasks';

/** 轮询间隔（ms） */
const POLL_INTERVAL = 2000;

export function useTasks() {
  const { data, loading, error, reload } = useApi<ApiTask[]>(() => fetchTasks());

  /** 提交回测任务并轮询直到完成 */
  const submitAndPoll = useCallback(
    async (payload: {
      strategy: string;
      symbol?: string;
      timeframe?: string;
      initialCash?: number;
      slippage?: number;
      params?: Record<string, unknown>;
    }): Promise<ApiTask> => {
      const { id } = await submitBacktest(payload);

      return new Promise<ApiTask>((resolve, reject) => {
        const poll = async () => {
          try {
            const task = await fetchTask(id);
            if (task.status === 'completed' || task.status === 'failed') {
              resolve(task);
              reload();
              return;
            }
            setTimeout(poll, POLL_INTERVAL);
          } catch (err) {
            reject(err);
          }
        };
        setTimeout(poll, POLL_INTERVAL);
      });
    },
    [reload],
  );

  return { tasks: data ?? [], loading, error, reload, submitAndPoll };
}
