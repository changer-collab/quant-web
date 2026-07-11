import { apiGet } from './client';

export interface ApiModelInfo {
  id: string;
  algorithm: string;
  trainedAt: number;
  metrics: Record<string, unknown>;
}

export function fetchModels(): Promise<ApiModelInfo[]> {
  return apiGet<ApiModelInfo[]>('/models');
}
