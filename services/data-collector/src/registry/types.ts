import type { DataSourceAdapter } from '../adapters/types.js';

/** 适配器注册中心接口 */
export interface AdapterRegistry {
  /** 注册适配器（同名覆盖） */
  register(adapter: DataSourceAdapter): void;

  /** 按名称查找适配器 */
  get(name: string): DataSourceAdapter | undefined;

  /** 按域和数据类型查找所有匹配的适配器 */
  findByDomainAndType(domain: string, dataType: string): DataSourceAdapter[];

  /** 列出所有已注册适配器 */
  list(): DataSourceAdapter[];
}
