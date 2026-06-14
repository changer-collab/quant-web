// factor-lab 核心接口（待实现）

// 因子运行时接口
// export { FactorEngine } from './engine.js';

// 评估器接口
// export { SortingEvaluator } from './evaluators/sorting.js';
// export { ICEvaluator } from './evaluators/ic.js';
// export { RegressionEvaluator } from './evaluators/regression.js';

// 因子注册中心
// export { FactorRegistry } from './registry.js';

// 从 @quant/common 重新导出因子类型（作为权威来源）
export {
  FactorEvalTab,
  FactorStatus,
} from '@quant/common';
export type {
  FactorDefinition,
  FactorMetrics,
  FactorEvaluationResult,
  FactorRow,
} from '@quant/common';
