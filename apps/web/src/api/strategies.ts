import { apiGet } from './client';

export interface ApiStrategy {
  name: string;
  description: string;
  params: ApiStrategyParam[];
  version: string;
  modes?: string[];
  /** 策略类型标识（与 Python StrategyKind 对齐） */
  kind?: string;
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
