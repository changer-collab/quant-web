import type { StrategyParamDef } from '@quant/common';
import { ResearchMode } from '@quant/common';

export interface StrategyMeta {
  name: string;
  description: string;
  modes: ResearchMode[];
  params: StrategyParamDef[];
  version: string;
  /** 策略依赖的因子 ID 列表，运行时由回测引擎从 factor-lab 解析并注入 StrategyContext */
  requiredFactors?: string[];
}
