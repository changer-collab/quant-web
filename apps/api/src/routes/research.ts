import type { FastifyInstance } from 'fastify';
import { ResearchStateError } from '../research/service.js';
import type { CreateResearchEventInput, ResearchCandidate } from '../research/types.js';

function errorResponse(reply: { code: (statusCode: number) => { send: (body: object) => unknown } }, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return reply.code(error instanceof ResearchStateError ? 409 : 404).send({ error: message });
}

export async function researchRoutes(app: FastifyInstance): Promise<void> {
  app.get('/sessions', async () => app.researchService.listSessions());

  app.get<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    const detail = await app.researchService.getSessionDetail(req.params.id);
    return detail ?? reply.code(404).send({ error: '研究过程不存在' });
  });

  app.post('/sessions/manual-inspiration', async (req, reply) => {
    const body = req.body as { strategy?: string; title?: string; content?: string };
    if (!body.strategy?.trim() || !body.content?.trim()) {
      return reply.code(400).send({ error: 'strategy 和 content 必填' });
    }
    const result = await app.researchService.addManualInspiration({
      strategy: body.strategy,
      title: body.title,
      content: body.content,
    });
    return reply.code(201).send(result);
  });

  app.put<{ Params: { id: string } }>('/sessions/:id', async (req, reply) => {
    try {
      const body = req.body as { title?: string; candidate?: ResearchCandidate };
      return await app.researchService.updateSession(req.params.id, body);
    } catch (error) {
      return errorResponse(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>('/sessions/:id/finish', async (req, reply) => {
    try {
      return await app.researchService.finishSession(req.params.id);
    } catch (error) {
      return errorResponse(reply, error);
    }
  });

  app.post<{ Params: { id: string; eventId: string } }>('/sessions/:id/events/:eventId/exclude', async (req, reply) => {
    try {
      await app.researchService.excludeEvent(req.params.id, req.params.eventId);
      return { ok: true };
    } catch (error) {
      return errorResponse(reply, error);
    }
  });

  app.post<{ Params: { id: string; eventId: string } }>('/sessions/:id/events/:eventId/assign', async (req, reply) => {
    try {
      await app.researchService.assignEvent(req.params.id, req.params.eventId);
      return { ok: true };
    } catch (error) {
      return errorResponse(reply, error);
    }
  });

  app.get('/events/unassigned', async () => app.researchService.listUnassignedEvents());
}

export async function internalResearchRoutes(app: FastifyInstance): Promise<void> {
  app.post('/events', async (req, reply) => {
    const body = req.body as Partial<CreateResearchEventInput>;
    if (!body.eventType || !body.dedupeKey || !body.payload || !body.occurredAt) {
      return reply.code(400).send({ error: 'eventType、dedupeKey、payload、occurredAt 必填' });
    }
    const result = await app.researchService.ingestEvent(body as CreateResearchEventInput);
    return reply.code(result.created ? 201 : 200).send(result);
  });

  app.get<{ Params: { source: string } }>('/collectors/:source', async (req, reply) => {
    const state = await app.researchService.getCollectorState(req.params.source);
    return state ?? reply.code(404).send({ error: '采集游标不存在' });
  });

  app.put<{ Params: { source: string } }>('/collectors/:source', async (req, reply) => {
    const body = req.body as { lastValue?: string };
    if (!body.lastValue) return reply.code(400).send({ error: 'lastValue 必填' });
    await app.researchService.saveCollectorState(req.params.source, body.lastValue);
    return { ok: true };
  });
}
