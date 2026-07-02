/**
 * 策略配置 CRUD 端点
 *
 * Phase 3c 改造：
 * - GET  /:name/config → 使用 configService.getOrDefault()，始终 200（含默认值），策略不存在 → 404
 * - PUT  /:name/config → 支持旧 shape {config, hash} 与新 shape {category,subcategory,params,expectedHash}
 *   hash 冲突 → 409（ConfigHashConflictError）；无效 category → 422；空 body → 400
 */
import type { FastifyInstance } from 'fastify';
import { strategySyncService } from '../services/strategy-sync.js';
import { ConfigHashConflictError } from '../services/config-service.js';
import type { ConfigSnapshot, StrategyCategory } from '../types.js';

export async function configRoutes(app: FastifyInstance) {
  /** GET /:name/config — 读取策略最新配置（不存在时返回默认值） */
  app.get<{ Params: { name: string } }>('/:name/config', async (req, reply) => {
    // 查策略注册表获取 version / category
    const strategies = await strategySyncService.syncFromPython();
    const meta = strategies.find((m) => m.name === req.params.name);
    if (!meta) {
      return reply.code(404).send({ error: 'Strategy not found' });
    }

    const result = await app.configService.getOrDefault(
      meta.name,
      meta.version,
      meta.category as StrategyCategory,
    );

    // result = { persisted: boolean, configSnapshot: ConfigSnapshot }
    return result;
  });

  /** PUT /:name/config — 保存/更新策略配置 */
  app.put<{ Params: { name: string } }>('/:name/config', async (req, reply) => {
    // 查策略注册表
    const strategies = await strategySyncService.syncFromPython();
    const meta = strategies.find((m) => m.name === req.params.name);
    if (!meta) {
      return reply.code(404).send({ error: 'Strategy not found' });
    }

    const body = req.body as Record<string, unknown>;
    if (!body || Object.keys(body).length === 0) {
      return reply.code(400).send({ error: 'Request body is required' });
    }

    let snapshot: ConfigSnapshot;
    let expectedHash: string | undefined;

    if ('config' in body) {
      // 旧 shape: { config, hash } — 封装为 ConfigSnapshot，不校验 expectedHash
      snapshot = {
        strategy: req.params.name,
        schemaVersion: 1,
        strategyVersion: meta.version,
        category: (meta.category ?? 'non_factor') as StrategyCategory,
        params: (body.config as Record<string, unknown>) ?? {},
        hash: typeof body.hash === 'string' ? body.hash : '',
        updatedAt: Date.now(),
      };
    } else {
      // 新 shape: { category?, subcategory?, params?, expectedHash? }
      snapshot = {
        strategy: req.params.name,
        schemaVersion: 1,
        strategyVersion: meta.version,
        category: (body.category as StrategyCategory) ?? (meta.category ?? 'non_factor') as StrategyCategory,
        subcategory: body.subcategory as string | undefined,
        params: (body.params as Record<string, unknown>) ?? {},
        hash: '',
        updatedAt: Date.now(),
      };
      expectedHash = body.expectedHash as string | undefined;
    }

    try {
      const savedSnapshot = await app.configService.save(snapshot, expectedHash);
      return reply.code(201).send({ saved: true, configSnapshot: savedSnapshot });
    } catch (err) {
      if (err instanceof ConfigHashConflictError) {
        return reply.code(409).send({
          error: 'Config hash conflict',
          currentHash: err.currentHash,
          currentSnapshot: err.currentSnapshot,
        });
      }
      if (err instanceof Error && err.message.startsWith('Invalid category')) {
        return reply.code(422).send({ error: err.message });
      }
      throw err;
    }
  });
}
