/** 因子评估器标签 */
export enum FactorEvalTab {
  /** 分组收益（因子值排序法） */
  Sorting = 'sorting',
  /** IC / Rank IC 分析 */
  ICAnalysis = 'icAnalysis',
  /** Fama-MacBeth 回归 */
  Regression = 'regression',
}

/** 因子状态 */
export enum FactorStatus {
  Active = 'active',
  Deprecated = 'deprecated',
  Draft = 'draft',
}

/** 因子定义（研究入参） */
export interface FactorDefinition {
  /** 因子 ID（唯一标识） */
  id: string;
  /** 因子名称 */
  name: string;
  /** 计算公式（表达式或描述） */
  formula: string;
  /** 所属分类 */
  category: string;
  /** 适用研究模式 */
  modes: import('./task').ResearchMode[];
  /** 计算频率 */
  frequency: import('./market').TimeFrame;
  /** 因子状态 */
  status: FactorStatus;
  /** 版本号 */
  version: string;
}

/** 因子评估指标 */
export interface FactorMetrics {
  /** IC 均值 */
  ic: number;
  /** Rank IC 均值 */
  rankIc: number;
  /** 多空分组年化收益 */
  longShortReturn: number;
  /** 最大回撤 */
  maxDrawdown: number;
  /** IC 胜率 */
  icWinRate: number;
  /** 因子换手率 */
  turnover: number;
}

/** 因子评估结果（对应一个因子定义） */
export interface FactorEvaluationResult {
  factorId: string;
  /** 评估窗口 */
  evaluationWindow: string;
  /** 当前激活的评估器标签 */
  activeTab: FactorEvalTab;
  /** 通用指标 */
  metrics: FactorMetrics;
}

/** 前端因子列表行 */
export interface FactorRow {
  id: string;
  name: string;
  formula: string;
  category: string;
  ic: number;
  rankIc: number;
  longShortReturn: number;
  status: FactorStatus;
}
