import { apiGet } from './client';

export interface ApiStrategy {
  name: string;
  description: string;
  params: ApiStrategyParam[];
  version: string;
  modes?: string[];
}

export interface ApiStrategyParam {
  key: string;
  label: string;
  type: string;
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
}

export function fetchStrategies(): Promise<ApiStrategy[]> {
  return apiGet<ApiStrategy[]>('/strategies');
}

export function fetchStrategy(name: string): Promise<ApiStrategy> {
  return apiGet<ApiStrategy>(`/strategies/${name}`);
}
