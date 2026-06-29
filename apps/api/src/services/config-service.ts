/**
 * 策略配置服务
 *
 * 纯业务逻辑层，不依赖 Drizzle/sql.js，只依赖 Repository 接口。
 */
import type { IConfigRepo } from '../repositories/interfaces.js';
import type { StrategyConfig } from '../types.js';

export class StrategyConfigService {
  constructor(private repo: IConfigRepo) {}

  /** 获取策略最新配置 */
  async getConfig(strategy: string): Promise<StrategyConfig | null> {
    return this.repo.get(strategy);
  }

  /** 保存策略配置 */
  async saveConfig(strategy: string, configJson: Record<string, unknown>, hash: string): Promise<void> {
    return this.repo.save(strategy, configJson, hash);
  }
}

// Fastify 实例类型扩展，使路由可通过 app.configService 访问
declare module 'fastify' {
  interface FastifyInstance {
    configService: StrategyConfigService;
  }
}
