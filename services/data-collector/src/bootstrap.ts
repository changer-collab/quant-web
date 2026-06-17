import { AdapterRegistryImpl } from './registry/index.js';
import { CollectorScheduler } from './scheduler.js';
import { CsvAdapter, TushareAdapter, AkshareAdapter, BaostockAdapter, EfinanceAdapter, YfinanceAdapter } from './adapters/index.js';

/**
 * 采集器启动配置
 */
export interface CollectorBootstrapConfig {
  /** 启用的数据源列表，不传则启用全部 */
  sources?: ('tushare' | 'akshare' | 'csv' | 'baostock' | 'efinance' | 'yfinance')[];
  /** 数据目录路径（SQLite 文件等），默认 ./data */
  dataDir?: string;
}

/**
 * 采集器启动结果
 */
export interface CollectorBootstrapResult {
  /** 适配器注册表 */
  registry: AdapterRegistryImpl;
  /** 任务调度器 */
  scheduler: CollectorScheduler;
}

/**
 * 创建采集器实例
 *
 * 一次性注册所有启用的适配器，返回 registry 和 scheduler。
 * 调用方通过 scheduler.execute(task) 执行采集任务，需要自行创建 RepositorySet 并注入。
 */
export function createCollector(config?: CollectorBootstrapConfig): CollectorBootstrapResult {
  const registry = new AdapterRegistryImpl();
  const sources = config?.sources ?? ['akshare', 'baostock', 'efinance', 'yfinance', 'tushare', 'csv'];

  for (const source of sources) {
    switch (source) {
      case 'tushare':
        registry.register(new TushareAdapter());
        break;
      case 'akshare':
        registry.register(new AkshareAdapter());
        break;
      case 'csv':
        registry.register(new CsvAdapter());
        break;
      case 'baostock':
        registry.register(new BaostockAdapter());
        break;
      case 'efinance':
        registry.register(new EfinanceAdapter());
        break;
      case 'yfinance':
        registry.register(new YfinanceAdapter());
        break;
      default:
        console.warn(`未知数据源: ${source}，已跳过`);
    }
  }

  // CollectorScheduler 需要外部传入 RepositorySet，这里只创建 registry
  // 调用方可以自己用 new CollectorScheduler(registry, repos) 注入 repos
  const scheduler = new CollectorScheduler(registry, undefined as any);

  return { registry, scheduler };
}