/**
 * API 层内联类型定义
 * 核心逻辑已迁移到 Python 包，这些类型仅供 API 层使用
 */

/** 任务类型 */
export enum TaskType {
  Backtest = 'backtest',
  FactorCompute = 'factor_compute',
  FactorEval = 'factor_eval',
  AITrain = 'ai_train',
}

/** 任务状态 */
export enum TaskStatus {
  Pending = 'pending',
  Running = 'running',
  Completed = 'completed',
  Failed = 'failed',
}

/** 研究模式 */
export enum ResearchMode {
  Traditional = 'traditional',
  Quantitative = 'quantitative',
  AiAssisted = 'ai_assisted',
}

/** 参数类型 */
export enum ParamType {
  Number = 'number',
  String = 'string',
  Boolean = 'boolean',
  Select = 'select',
}

/** 因子状态 */
export enum FactorStatus {
  Active = 'active',
  Deprecated = 'deprecated',
  Draft = 'draft',
}

/** 因子定义 */
export interface FactorDefinition {
  id: string;
  name: string;
  formula: string;
  category: string;
  modes: ResearchMode[];
  frequency: string;
  status: FactorStatus;
  version: string;
}
