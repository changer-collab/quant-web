import { apiGet } from './client';

export interface ApiStrategy {
  name: string;
  description: string;
  params: ApiStrategyParam[];
  version: string;
  modes?: string[];
  /** 策略类型标识（与 Python StrategyKind 对齐） */
  kind?: string;
  /** 是否可独立回测（组件策略如选股器/择时器/仓位器不可独立回测） */
  backtestable?: boolean;
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
