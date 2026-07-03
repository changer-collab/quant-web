import { apiGet, apiPut } from './client';
import type { ConfigSnapshot } from '../data/types';

/** 策略配置响应（Phase 3c 新契约 — persisted + configSnapshot） */
export interface PersistedConfigResponse {
  persisted: boolean;
  configSnapshot: ConfigSnapshot;
  /** @deprecated 过渡期保留 — 组件迁移到 configSnapshot 后移除 */
  config_json: Record<string, unknown>;
  /** @deprecated */
  hash: string;
  /** @deprecated */
  updated_at: number;
}

/** 保存策略配置响应 */
export interface ApiConfigSaveResponse {
  saved: boolean;
  configSnapshot: ConfigSnapshot;
}

/** 获取策略配置（失败返回 null） */
export function fetchStrategyConfig(name: string): Promise<PersistedConfigResponse | null> {
  return apiGet<PersistedConfigResponse>(`/strategies/${encodeURIComponent(name)}/config`).catch(
    () => null
  );
}

/**
 * 保存策略配置
 *
 * 支持新旧两种调用签名（过渡期向后兼容）：
 * - 新签名: (name, category, subcategory, params, expectedHash?)
 * - 旧签名: (name, config, hash?)
 */
export function saveStrategyConfig(
  name: string,
  categoryOrConfig: string | Record<string, unknown>,
  subcategoryOrHash?: string | null,
  paramsOrVoid?: Record<string, unknown>,
  expectedHash?: string
): Promise<ApiConfigSaveResponse | { saved: false }> {
  // 旧签名兼容: saveStrategyConfig(name, configPayload, hash?)
  if (typeof categoryOrConfig === 'object') {
    return apiPut<ApiConfigSaveResponse>(
      `/strategies/${encodeURIComponent(name)}/config`,
      { config: categoryOrConfig, hash: subcategoryOrHash ?? '' }
    ).catch(() => ({ saved: false }));
  }
  // 新签名: saveStrategyConfig(name, category, subcategory, params, expectedHash?)
  return apiPut<ApiConfigSaveResponse>(
    `/strategies/${encodeURIComponent(name)}/config`,
    {
      category: categoryOrConfig,
      subcategory: subcategoryOrHash ?? undefined,
      params: paramsOrVoid ?? {},
      expectedHash: expectedHash ?? undefined,
    }
  ).catch(() => ({ saved: false }));
}
