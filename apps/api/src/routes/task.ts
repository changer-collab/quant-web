import { TaskType } from '../types.js';
import type { FastifyInstance } from 'fastify';

export async function taskRoutes(app: FastifyInstance) {
  app.post('/', async (req, reply) => {
    const { type, payload } = req.body as { type: TaskType; payload: Record<string, unknown> };
    const task = app.taskService.submit(type, payload);
    return reply.code(202).send({ id: task.id, status: task.status });
  });

  app.get('/', async (req) => {
    const { type } = req.query as { type?: TaskType };
    return app.taskService.list(type);
  });

  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const task = app.taskService.get(req.params.id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return task;
  });
}
