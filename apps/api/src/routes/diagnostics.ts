/**
 * Diagnostics 路由
 *
 * GET  /api/diagnostics/:resultId  → 获取单个诊断结果（DiagnosticResultWire）
 * GET  /api/diagnostics?strategy=xxx → 列出策略的诊断历史（DiagnosticResultWire[]）
 */

import type { FastifyInstance } from 'fastify';
import type { DiagnosticResult, DiagnosticResultWire } from '../types.js';

/** 将持久化 DiagnosticResult 投影为 API 响应格式 DiagnosticResultWire */
function toWire(r: DiagnosticResult): DiagnosticResultWire {
  return {
    resultId: r.id,
    resultType: 'diagnostics',
    taskId: r.taskId,
    strategy: r.strategy,
    category: r.category,
    subcategory: r.subcategory ?? null,
    configSnapshot: r.configSnapshot,
    data: r.dataJson,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    engineVersion: r.engineVersion,
  };
}

export async function diagnosticRoutes(app: FastifyInstance) {
  /** 获取单个诊断结果（投影为 DiagnosticResultWire） */
  app.get<{ Params: { resultId: string } }>('/:resultId', async (req, reply) => {
    const result = await app.diagnosticService.getById(req.params.resultId);
    if (!result) return reply.code(404).send({ error: 'Diagnostic result not found' });
    return toWire(result);
  });

  /** 按策略名列出诊断历史（投影为 DiagnosticResultWire[]） */
  app.get('/', async (req, reply) => {
    const { strategy } = req.query as { strategy?: string };
    if (!strategy) {
      return reply.code(400).send({ error: 'Query parameter "strategy" is required' });
    }
    const results = await app.diagnosticService.listByStrategy(strategy);
    return results.map(toWire);
  });
}
