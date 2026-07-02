import { useCallback } from 'react';
import { useApi } from './useApi';
import {
  fetchTasks,
  submitBacktest,
  streamTask,
  type ApiTask,
  type TaskStreamEvent,
} from '../api/tasks';

export function useTasks() {
  const { data, loading, error, reload } = useApi<ApiTask[]>(() => fetchTasks());

  /** 提交回测任务，返回 taskId */
  const submitBacktestTask = useCallback(
    async (payload: {
      strategy: string;
      symbol: string;
      timeframe: string;
      initialCash?: number;
      slippage?: number;
      startTs?: number;
      endTs?: number;
      params?: Record<string, unknown>;
    }): Promise<string> => {
      const { id } = await submitBacktest(payload);
      return id;
    },
    []
  );

  /** 通过 SSE 流式跟踪任务 */
  const submitAndStream = useCallback(
    (taskId: string, onEvent: (event: TaskStreamEvent) => void): (() => void) => {
      const timer = setTimeout(() => {
        onEvent({ type: 'error', taskId, error: { code: 'TIMEOUT', message: 'Task timed out' } });
      }, 60_000);
      const close = streamTask(
        taskId,
        (event) => {
          if (event.type === 'result' || event.type === 'error') clearTimeout(timer);
          onEvent(event);
        },
        () => {
          clearTimeout(timer);
          onEvent({
            type: 'error',
            taskId,
            error: { code: 'SSE_ERROR', message: 'SSE connection failed' },
          });
        }
      );
      return () => {
        clearTimeout(timer);
        close();
      };
    },
    []
  );

  /** 提交回测任务并轮询直到完成（兼容旧用法） */
  const submitAndPoll = useCallback(
    async (payload: {
      strategy: string;
      symbol: string;
      timeframe: string;
      initialCash?: number;
      slippage?: number;
      startTs?: number;
      endTs?: number;
      params?: Record<string, unknown>;
    }): Promise<ApiTask> => {
      const taskId = await submitBacktestTask(payload);

      return new Promise<ApiTask>((resolve, reject) => {
        const close = submitAndStream(taskId, (event) => {
          if (event.type === 'result') {
            close();
            reload();
            resolve({
              id: taskId,
              type: 'backtest',
              status: 'completed',
              payload: {},
              submittedAt: Date.now(),
              result: event.data,
            });
          } else if (event.type === 'error') {
            close();
            reject(new Error(event.error?.message ?? 'Task failed'));
          }
        });
      });
    },
    [submitBacktestTask, submitAndStream, reload]
  );

  return {
    tasks: data ?? [],
    loading,
    error,
    reload,
    submitBacktestTask,
    submitAndStream,
    submitAndPoll,
  };
}
