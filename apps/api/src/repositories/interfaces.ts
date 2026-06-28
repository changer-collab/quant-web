/**
 * Repository 接口定义
 *
 * 这些接口将底层的 SQLite/Drizzle 操作抽象为业务契约，
 * Service 层只依赖这些接口，不依赖具体实现。
 */

import type { StrategyConfig, ConfigSnapshot, DiagnosticResult } from '../types.js';
import type { StrategyParamDef } from '../types.js';

export interface IConfigRepo {
  /** 获取策略最新配置，不存在时返回 null */
  get(strategy: string): Promise<StrategyConfig | null>;

  /** 保存策略配置（同时写入历史记录） */
  save(strategy: string, configJson: Record<string, unknown>, hash: string): Promise<void>;
}

export interface IConfigHistoryRepo {
  /** 追加一条历史记录 */
  append(strategy: string, configJson: Record<string, unknown>, hash: string): Promise<void>;

  /** 列出策略的配置历史（按时间倒序） */
  list(strategy: string, limit?: number, offset?: number): Promise<Array<{ id: number; strategy: string; configJson: Record<string, unknown>; hash: string; createdAt: number }>>;
}

export interface IDiagnosticRepo {
  /** 保存诊断结果 */
  save(result: DiagnosticResult): Promise<void>;

  /** 根据 ID 获取诊断结果 */
  getById(id: string): Promise<DiagnosticResult | null>;

  /** 按策略名列出诊断结果（按时间倒序） */
  listByStrategy(strategy: string, limit?: number): Promise<DiagnosticResult[]>;

  /** 删除 N 天前的诊断结果 */
  purgeOlderThan(days: number): Promise<number>;
}

/** 策略参数定义查询接口 */
export interface IParamDefRepo {
  /** 获取策略的参数定义列表 */
  getParamDefs(strategy: string): Promise<StrategyParamDef[]>;
}
