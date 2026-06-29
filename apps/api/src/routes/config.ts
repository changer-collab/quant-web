/**
 * 策略配置 CRUD 端点
 *
 * GET  /api/strategies/:name/config — 读取策略最新配置
 * PUT  /api/strategies/:name/config — 保存/更新策略配置
 */
import type { FastifyInstance } from 'fastify';

export async function configRoutes(app: FastifyInstance) {
  /** 读取策略配置 — 不存在时返回 404 */
  app.get<{ Params: { name: string } }>('/:name/config', async (req, reply) => {
    const config = await app.configService.getConfig(req.params.name);
    if (!config) {
      return reply.code(404).send({ error: 'Config not found' });
    }
    return config;
  });

  /** 保存策略配置 — 成功返回 201 + { saved: true, hash } */
  app.put<{ Params: { name: string } }>('/:name/config', async (req, reply) => {
    const { config, hash } = req.body as { config: Record<string, unknown>; hash: string };
    await app.configService.saveConfig(req.params.name, config, hash);
    return reply.code(201).send({ saved: true, hash });
  });
}
