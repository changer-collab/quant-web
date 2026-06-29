/**
 * 诊断结果服务
 *
 * 纯业务逻辑层，不依赖 Drizzle/sql.js，只依赖 Repository 接口。
 */
import type { IDiagnosticRepo } from '../repositories/interfaces.js';
import type { DiagnosticResult } from '../types.js';

export class DiagnosticService {
  constructor(private repo: IDiagnosticRepo) {}

  /** 根据 ID 获取诊断结果 */
  async getById(id: string): Promise<DiagnosticResult | null> {
    return this.repo.getById(id);
  }

  /** 按策略名列出诊断结果 */
  async listByStrategy(strategy: string): Promise<DiagnosticResult[]> {
    return this.repo.listByStrategy(strategy);
  }

  /** 保存诊断结果 */
  async storeResult(result: DiagnosticResult): Promise<void> {
    return this.repo.save(result);
  }

  /** 清理过期结果 */
  async purgeExpired(days = 7): Promise<number> {
    return this.repo.purgeOlderThan(days);
  }
}

// Fastify 实例类型扩展，使路由可通过 app.diagnosticService 访问
declare module 'fastify' {
  interface FastifyInstance {
    diagnosticService: DiagnosticService;
  }
}
