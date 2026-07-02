import { apiPost } from './client';
import type { PreviewResponse } from '../data/types';

/** 预览请求体 */
export interface PreviewRequestBody {
  symbol: string;
  timeframe: string;
  cursor?: number | null;
  limit?: number;
  preview_params?: Record<string, unknown>;
}

/** 获取策略 K 线预览 */
export function fetchPreview(
  strategyName: string,
  body: PreviewRequestBody
): Promise<PreviewResponse> {
  return apiPost<PreviewResponse>(`/strategies/${encodeURIComponent(strategyName)}/preview`, body);
}
