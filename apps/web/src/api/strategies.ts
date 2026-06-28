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
  /** 策略分类（与 Python StrategyCategory 对齐） */
  category?: string;
  /** 策略子分类（与 Python StrategySubcategory 对齐） */
  subcategory?: string | null;
  /** 是否可进入工作流 */
  workflowReady?: boolean;
  /** 策略摘要 */
  summary?: string;
}

export interface ApiStrategyParam {
  key: string;
  label: string;
  type: string;
  default: number | string | boolean;
  min?: number;
  max?: number;
  options?: string[];
  /** 是否在 K 线预览中显示 */
  chart_relevant?: boolean;
  /** UI 约束条件列表 */
  ui_constraints?: Array<{
    kind: string;
    target_field: string;
    target_value: unknown;
    action_value?: unknown;
  }>;
}

export function fetchStrategies(): Promise<ApiStrategy[]> {
  return apiGet<ApiStrategy[]>('/strategies');
}

export function fetchStrategy(name: string): Promise<ApiStrategy> {
  return apiGet<ApiStrategy>(`/strategies/${name}`);
}
