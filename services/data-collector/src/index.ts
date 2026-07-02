// @quant/data-collector — 统一导出

// 类型
export { CollectorDomain } from './types.js';
export type { CollectorTask, CollectorResult, CollectorConfig, TaskStatus } from './types.js';

// 适配器
export {
  CsvAdapter,
  TushareAdapter,
  AkshareAdapter,
  BaostockAdapter,
  EfinanceAdapter,
  YfinanceAdapter,
} from './adapters/index.js';
export type {
  DataSourceAdapter,
  RawDataRecord,
  AdapterFetchOptions,
  TushareExtra,
  AkshareExtra,
  CsvExtra,
  BaostockExtra,
  EfinanceExtra,
  YfinanceExtra,
  AdapterExtra,
} from './adapters/types.js';

// 注册中心
export { AdapterRegistryImpl } from './registry/index.js';
export type { AdapterRegistry } from './registry/types.js';

// 清洗器
export { DataCleaner } from './cleaner.js';

// 调度器
export { CollectorScheduler } from './scheduler.js';

// 预设任务
export { CollectorPresets } from './presets.js';

// 数据源选择器（冗余回退）
export { SOURCE_PRIORITY, getSourcePriority, executeWithFallback } from './source-selector.js';

// 启动入口
export { createCollector } from './bootstrap.js';
export type { CollectorBootstrapConfig, CollectorBootstrapResult } from './bootstrap.js';
