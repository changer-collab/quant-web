import { TaskType, TaskStatus } from '../types.js';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReportRepository } from '../storage/report-repo.js';
import { mapBacktestResultToReport } from '../services/report-mapper.js';
import type { BacktestResult } from '../types.js';

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
  app.get<{ Params: { id: string } }>('/:id/stream', async (req: FastifyRequest, reply: FastifyReply) => {
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

  /** Worker 完成任务 */
  app.post<{ Params: { id: string } }>('/:id/complete', async (req, reply) => {
    const task = await app.taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    const { result } = req.body as { result: Record<string, unknown> };
    await app.taskService.updateTask(req.params.id, {
      status: TaskStatus.Completed,
      result,
      completedAt: Date.now(),
      progress: 100,
    }, { type: 'result', taskId: req.params.id, data: result });

    // 如果是回测任务，自动保存报告
    if (task.type === TaskType.Backtest) {
      try {
        const reportRepo = new ReportRepository();
        const taskResult = result as { backtestResult: BacktestResult; analysis?: Record<string, unknown> };
        const backtestResult = taskResult.backtestResult;
        const payload = task.payload as { strategy: string; symbol: string; timeframe: string };

        const report = mapBacktestResultToReport(backtestResult, {
          strategyName: payload.strategy,
          symbol: payload.symbol,
          timeframe: payload.timeframe,
        });

        // 合并 AI 分析结果到报告（覆盖结论性字段）
        if (taskResult.analysis) {
          const ai = taskResult.analysis as Record<string, unknown>;
          if (ai.executiveSummary) {
            const es = ai.executiveSummary as Record<string, unknown>;
            report.executiveSummary = {
              ...report.executiveSummary,
              oneLineConclusion: es.oneLineConclusion as string ?? report.executiveSummary.oneLineConclusion,
              recommendedForLive: es.recommendedForLive as boolean ?? report.executiveSummary.recommendedForLive,
            };
          }
          if (ai.overview) {
            const ov = ai.overview as Record<string, unknown>;
            report.overview = {
              ...report.overview,
              logic: ov.logic as string ?? report.overview.logic,
              suitableMarketRegime: ov.suitableMarketRegime as string[] ?? report.overview.suitableMarketRegime,
            };
          }
          if (ai.issues) {
            const iss = ai.issues as Record<string, unknown>;
            report.issues = {
              ...report.issues,
              liquidityAssessment: iss.liquidityAssessment as string ?? report.issues.liquidityAssessment,
              capacityEstimate: iss.capacityEstimate as string ?? report.issues.capacityEstimate,
            };
          }
          if (ai.conclusion) {
            const con = ai.conclusion as Record<string, unknown>;
            report.conclusion = {
              ...report.conclusion,
              advantages: con.advantages as string[] ?? report.conclusion.advantages,
              potentialRisks: con.potentialRisks as string[] ?? report.conclusion.potentialRisks,
              improvements: con.improvements as string[] ?? report.conclusion.improvements,
            };
          }
          if (ai.riskWarnings) {
            const rw = ai.riskWarnings as Record<string, unknown>;
            report.riskWarnings = {
              ...report.riskWarnings,
              limitations: (rw.limitations as Array<{ category: string; description: string }>) ?? report.riskWarnings.limitations,
              redLines: (rw.redLines as Array<{ rule: string; threshold: string; actual: string; passed: boolean }>) ?? report.riskWarnings.redLines,
            };
          }
        }

        await reportRepo.save({
          id: report.id,
          taskId: task.id,
          strategyName: payload.strategy,
          symbol: payload.symbol,
          timeframe: payload.timeframe,
          createdAt: Date.now(),
          totalReturn: backtestResult.metrics.totalReturn,
          annualizedReturn: backtestResult.metrics.annualizedReturn,
          sharpeRatio: backtestResult.metrics.sharpeRatio,
          maxDrawdown: backtestResult.metrics.maxDrawdown,
          winRate: backtestResult.metrics.winRate,
          totalTrades: backtestResult.metrics.totalTrades,
          reportData: report,
        });
      } catch (err) {
        // 报告保存失败不影响任务完成
        console.error('[api] Failed to save backtest report:', err);
      }
    }

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
