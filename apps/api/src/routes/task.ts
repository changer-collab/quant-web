import { TaskType, TaskStatus } from '../types.js';
import type { FastifyInstance } from 'fastify';

export async function taskRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const { type, payload } = req.body as { type: TaskType; payload: Record<string, unknown> };
    const task = await app.taskService.submit(type, payload);
    return reply.code(202).send({ id: task.id, status: task.status });
  });

  app.get('/', async (req) => {
    const { type, status } = req.query as { type?: TaskType; status?: TaskStatus };
    return await app.taskService.list({ type, status });
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const task = await app.taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return task;
  });

  /** SSE: 流式推送任务事件 */
  app.get<{ Params: { id: string } }>('/:id/stream', async (req, reply) => {
    const taskId = (req.params as { id: string }).id;
    const task = await app.taskService.get(taskId);
    if (!task) {
      return reply.code(404).send({ error: 'Task not found' });
    }

    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 发送初始状态
    reply.raw.write(`data: ${JSON.stringify({ type: 'status', taskId, message: task.status, percent: task.progress ?? 0 })}\n\n`);

    // 订阅后续事件
    const unsubscribe = app.taskService.subscribe(taskId, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      // 任务终态时关闭连接
      if (event.type === 'result' || event.type === 'error') {
        unsubscribe();
        reply.raw.end();
      }
    });

    // 如果任务已完成，直接发送终态事件
    if (task.status === 'completed' || task.status === 'failed') {
      const finalEvent = task.status === 'completed'
        ? { type: 'result' as const, taskId, data: task.result }
        : { type: 'error' as const, taskId, error: { code: 'TASK_FAILED', message: task.error ?? 'Unknown error' } };
      reply.raw.write(`data: ${JSON.stringify(finalEvent)}\n\n`);
      unsubscribe();
      reply.raw.end();
      return;
    }

    // 客户端断开时清理
    req.raw.on('close', () => {
      unsubscribe();
    });
  });
}

/** 内部路由 — 供 Worker 通过 HTTP 调用，不对外暴露 */
export async function internalTaskRoutes(app: FastifyInstance) {
  /** Worker 获取 pending 任务 */
  app.get('/pending', async () => {
    return await app.taskService.list({ status: TaskStatus.Pending });
  });

  /** Worker 认领任务（pending → running） */
  app.post<{ Params: { id: string } }>('/:id/claim', async (req, reply) => {
    const task = await app.taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    if (task.status !== TaskStatus.Pending) {
      return reply.code(409).send({ error: 'Task is not pending' });
    }
    await app.taskService.updateTask(req.params.id, {
      status: TaskStatus.Running,
      startedAt: Date.now(),
    }, { type: 'status', taskId: req.params.id, message: TaskStatus.Running });
    return { ok: true };
  });

  /** Worker 推送事件（progress/log） */
  app.post<{ Params: { id: string } }>('/:id/event', async (req, reply) => {
    const task = await app.taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    const event = req.body as { type: 'progress' | 'log'; percent?: number; message?: string; level?: string };
    await app.taskService.updateTask(req.params.id, {}, {
      type: event.type,
      taskId: req.params.id,
      percent: event.percent,
      message: event.message,
      level: event.level,
    });
    if (event.type === 'progress' && event.percent !== undefined) {
      await app.taskService.updateTask(req.params.id, { progress: event.percent });
    }
    return { ok: true };
  });

  /**
   * Worker 完成任务（退化为统一分派）
   *
   * 1) 查注册表获取 task.type 对应的 ResultProcessor
   * 2) 有 processor → 调用 process() 产出信封 {resultId, resultType, data}
   * 3) 无 processor → 原样完成
   * 4) processor 抛异常 → 标记任务 failed
   * 5) 统一更新 task + 推送 SSE result/error 事件
   */
  app.post<{ Params: { id: string } }>('/:id/complete', async (req, reply) => {
    const task = await app.taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    const { result } = req.body as { result: Record<string, unknown> };

    let enrichedResult = result;
    let sseResultId: string | undefined;
    let sseResultType: string | undefined;

    const processor = app.resultProcessorRegistry.get(task.type);
    if (processor) {
      try {
        const envelope = await processor.process({
          task: { id: task.id, type: task.type, payload: task.payload as Record<string, unknown> },
          result,
        });
        enrichedResult = { ...result, resultId: envelope.resultId, resultType: envelope.resultType };
        sseResultId = envelope.resultId;
        sseResultType = envelope.resultType;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await app.taskService.updateTask(req.params.id, {
          status: TaskStatus.Failed,
          error: msg,
          completedAt: Date.now(),
        }, { type: 'error', taskId: req.params.id, error: { code: 'PROCESSOR_ERROR', message: msg } });
        return { ok: true };
      }
    }

    await app.taskService.updateTask(req.params.id, {
      status: TaskStatus.Completed,
      result: enrichedResult,
      completedAt: Date.now(),
      progress: 100,
    }, { type: 'result', taskId: req.params.id, resultId: sseResultId, resultType: sseResultType, data: enrichedResult });

    return { ok: true };
  });

  /** Worker 报告任务失败 */
  app.post<{ Params: { id: string } }>('/:id/fail', async (req, reply) => {
    const task = await app.taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    const { error } = req.body as { error: string };
    await app.taskService.updateTask(req.params.id, {
      status: TaskStatus.Failed,
      error,
      completedAt: Date.now(),
    }, { type: 'error', taskId: req.params.id, error: { code: 'TASK_FAILED', message: error } });
    return { ok: true };
  });
}
