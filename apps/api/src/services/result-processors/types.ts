/**
 * ResultProcessor 类型定义
 *
 * 每个任务类型注册一个 processor，其 process() 方法将 Worker 提交的原始 result
 * 转为带 resultId/resultType 的信封，供 complete handler 退化为统一分派。
 */
import type { TaskType } from '../../types.js';

export interface ResultProcessorContext {
  task: {
    id: string;
    type: TaskType;
    payload: Record<string, unknown>;
  };
  result: Record<string, unknown>;
}

export interface ResultProcessorOutput {
  resultId: string;
  resultType: string;
  data: Record<string, unknown>;
}

export interface ResultProcessor {
  process(ctx: ResultProcessorContext): Promise<ResultProcessorOutput>;
}

// Fastify 实例类型扩展
declare module 'fastify' {
  interface FastifyInstance {
    resultProcessorRegistry: Map<TaskType, ResultProcessor>;
  }
}
