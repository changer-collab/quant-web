import { apiGet, apiPut } from './client';

/** 策略配置响应 */
export interface ApiConfigResponse {
  config_json: Record<string, unknown>;
  hash: string;
  updated_at: number;
}

/** 保存策略配置响应 */
export interface ApiConfigSaveResponse {
  saved: boolean;
  hash: string;
}

/** 获取策略配置（未保存时返回 null） */
export function fetchStrategyConfig(name: string): Promise<ApiConfigResponse | null> {
  return apiGet<ApiConfigResponse | null>(`/strategies/${encodeURIComponent(name)}/config`);
}

/** 保存策略配置 */
export function saveStrategyConfig(
  name: string,
  config: Record<string, unknown>,
  hash?: string
): Promise<ApiConfigSaveResponse> {
  return apiPut<ApiConfigSaveResponse>(`/strategies/${encodeURIComponent(name)}/config`, {
    config,
    hash: hash ?? '',
  });
}
