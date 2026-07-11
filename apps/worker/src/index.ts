// types (migrated from deleted queue.ts)
export type { TaskRecord, TaskHandler, TaskEventHandler } from './types.js';

// python bridge
export { PythonBridge } from './python-bridge.js';
export type { PythonBridgeConfig, PythonResult } from './python-bridge.js';

// handlers
export { BacktestHandler } from './handlers/backtest-handler.js';
export { GitCollector, inferStrategyFromFiles } from './git-collector.js';
export type { GitCollectorApi, GitCollectorOptions, GitCommandRunner, GitScanResult } from './git-collector.js';
export type { BacktestPayload, BacktestTaskResult } from './handlers/backtest-handler.js';
export { CollectHandler } from './handlers/collect-handler.js';
export type { CollectPayload } from './handlers/collect-handler.js';
export { DiagnosticsHandler } from './handlers/diagnostics-handler.js';
export type { DiagnosticsPayload } from './handlers/diagnostics-handler.js';
export { FactorComputeHandler } from './handlers/factor-compute-handler.js';
export type {
  FactorComputePayload,
  FactorComputeEngine,
  FactorComputeRequest,
  FactorComputeBatchResult,
} from './handlers/factor-compute-handler.js';
export { FactorEvalHandler } from './handlers/factor-eval-handler.js';
export type {
  FactorEvalPayload,
  FactorEvalScheduler,
  FactorEvalParams,
  FactorEvalResult,
} from './handlers/factor-eval-handler.js';
