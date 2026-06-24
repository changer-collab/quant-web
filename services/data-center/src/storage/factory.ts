/**
 * 工厂函数 — 创建完整的 Repository 集合和 Provider 集合
 *
 * 当前实现：SQLite
 * 未来切换：将 createSqliteContext 换成 createPostgresContext，
 *           将 SQLite Repository 换成 PostgreSQL Repository，
 *           Provider 层和上层消费者零改动。
 */
import { createSqliteContext, saveDbToFile, type DrizzleDb, type SqliteContext } from './sqlite/connection.js';
import {
  SqliteBarRepository,
  SqliteTickRepository,
  SqliteInstrumentRepository,
  SqliteCalendarRepository,
  SqliteIndexCompositionRepository,
  SqliteAdjustmentFactorRepository,
  SqliteFinancialReportRepository,
  SqliteFinancialRatioRepository,
  SqliteValuationRepository,
  SqliteShareholderMetricsRepository,
  SqliteAnnouncementEventRepository,
  SqliteNewsRepository,
  SqliteSentimentRepository,
  SqliteMacroIndicatorRepository,
  SqliteLevel2SnapshotRepository,
  SqliteTradeRecordRepository,
  SqliteOrderRecordRepository,
  SqliteWatermarkRepository,
  SqliteFactorRepository,
  SqliteTaskRepository,
} from './sqlite/index.js';
import {
  ReferenceDataProviderImpl,
  MarketDataProviderImpl,
  FundamentalDataProviderImpl,
  EventDataProviderImpl,
  Level2DataProviderImpl,
  DataQualityCheckerImpl,
  DataExporterImpl,
} from '../provider/index.js';
import type { RepositorySet, DataExporter } from '../repository/types.js';
import type {
  ReferenceDataProvider,
  MarketDataProvider,
  FundamentalDataProvider,
  EventDataProvider,
  Level2DataProvider,
  DataQualityChecker,
} from '../index.js';
import { DataCenterError, CloseError } from '../errors.js';

// ─── 生命周期类型 ───────────────────────────────────────

/** 数据中心运行状态 */
export type DataCenterStatus = 'ready' | 'closing' | 'closed';

/** 持久化策略 */
export type PersistenceStrategy = 'immediate' | 'manual';

/** 生命周期钩子 */
export interface LifecycleHooks {
  /** 关闭前触发，返回 false 可阻止关闭 */
  beforeClose?: () => Promise<boolean>;
  /** 关闭完成后触发 */
  afterClose?: () => Promise<void>;
  /** 持久化完成后触发 */
  afterFlush?: () => void;
}

/** 数据中心配置 */
export interface DataCenterConfig {
  /** SQLite 数据库路径，默认 data/quant.db */
  dbPath?: string;
  /** 持久化策略：immediate=每次写入后保存，manual=只在 close() 时保存。默认 manual */
  persistence?: PersistenceStrategy;
  /** close() 超时毫秒数，0=不超时。默认 10000 */
  closeTimeout?: number;
  /** manual 模式下定时 flush 间隔毫秒数，0=不启用。默认 0 */
  flushInterval?: number;
  /** 生命周期钩子 */
  hooks?: LifecycleHooks;
}

/** 健康检查结果 */
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  /** 数据中心状态 */
  dcStatus: DataCenterStatus;
  /** 上次成功 flush 时间戳，无则为 undefined */
  lastFlushAt?: number;
  /** 异常信息 */
  error?: string;
}

/** 数据中心实例 — 包含所有 Provider 和 Repository */
export interface DataCenter {
  /** Repository 集合（供 data-collector 写入） */
  repos: RepositorySet;
  /** Provider 集合（供上层查询） */
  providers: {
    reference: ReferenceDataProvider;
    market: MarketDataProvider;
    fundamental: FundamentalDataProvider;
    event: EventDataProvider;
    l2: Level2DataProvider;
    quality: DataQualityChecker;
  };
  /** 数据导出器 */
  exporter: DataExporter;
  /** 关闭数据中心，持久化数据到磁盘并释放资源 */
  close(): Promise<void>;
  /** 查询当前运行状态 */
  status(): DataCenterStatus;
  /** 是否已关闭 */
  isClosed(): boolean;
  /** 手动持久化到磁盘（manual 模式下使用） */
  flush(): void;
  /** 健康检查 */
  healthCheck(): HealthCheckResult;
  /** 异步资源释放（支持 using 语法） */
  [Symbol.asyncDispose](): Promise<void>;
}

// ─── 工厂函数 ───────────────────────────────────────────

/** 创建 SQLite 版数据中心 */
export function createSqliteRepositorySet(db: DrizzleDb): RepositorySet {
  return {
    bars: new SqliteBarRepository(db),
    ticks: new SqliteTickRepository(db),
    instruments: new SqliteInstrumentRepository(db),
    calendars: new SqliteCalendarRepository(db),
    indexCompositions: new SqliteIndexCompositionRepository(db),
    adjustmentFactors: new SqliteAdjustmentFactorRepository(db),
    financialReports: new SqliteFinancialReportRepository(db),
    financialRatios: new SqliteFinancialRatioRepository(db),
    valuations: new SqliteValuationRepository(db),
    shareholderMetrics: new SqliteShareholderMetricsRepository(db),
    announcementEvents: new SqliteAnnouncementEventRepository(db),
    news: new SqliteNewsRepository(db),
    sentiments: new SqliteSentimentRepository(db),
    macroIndicators: new SqliteMacroIndicatorRepository(db),
    l2Snapshots: new SqliteLevel2SnapshotRepository(db),
    tradeRecords: new SqliteTradeRecordRepository(db),
    orderRecords: new SqliteOrderRecordRepository(db),
    watermarks: new SqliteWatermarkRepository(db),
    factors: new SqliteFactorRepository(db),
    tasks: new SqliteTaskRepository(db),
  };
}

/** 创建 Provider 集合 */
export function createProviders(repos: RepositorySet): DataCenter['providers'] {
  return {
    reference: new ReferenceDataProviderImpl(
      repos.instruments,
      repos.calendars,
      repos.indexCompositions,
      repos.adjustmentFactors,
    ),
    market: new MarketDataProviderImpl(repos.bars, repos.ticks),
    fundamental: new FundamentalDataProviderImpl(
      repos.financialReports,
      repos.financialRatios,
      repos.valuations,
      repos.shareholderMetrics,
    ),
    event: new EventDataProviderImpl(
      repos.announcementEvents,
      repos.news,
      repos.sentiments,
      repos.macroIndicators,
    ),
    l2: new Level2DataProviderImpl(
      repos.l2Snapshots,
      repos.tradeRecords,
      repos.orderRecords,
    ),
    quality: new DataQualityCheckerImpl(repos.bars, repos.calendars),
  };
}

/**
 * 创建数据中心 — 主入口（异步，因为 sql.js 需要加载 WASM）
 *
 * 用法：
 * ```ts
 * const dc = await createDataCenter({ dbPath: 'data/quant.db' });
 * // 写入（data-collector 用）
 * await dc.repos.bars.save([...bars]);
 * // 查询（上层用）
 * const bars = await dc.providers.market.loadBars('CSI500', TimeFrame.D1);
 * // 手动持久化（manual 模式）
 * dc.flush();
 * // 用完后关闭，持久化到磁盘
 * await dc.close();
 * ```
 *
 * 使用 using 语法自动关闭：
 * ```ts
 * await using dc = await createDataCenter({ dbPath: 'data/quant.db' });
 * // 作用域结束时自动 close()
 * ```
 */
export async function createDataCenter(config?: DataCenterConfig): Promise<DataCenter> {
  const ctx: SqliteContext = await createSqliteContext(config?.dbPath);
  const repos = createSqliteRepositorySet(ctx.db);
  const providers = createProviders(repos);
  const strategy = config?.persistence ?? 'manual';
  const closeTimeout = config?.closeTimeout ?? 10000;
  const flushInterval = config?.flushInterval ?? 0;
  const hooks = config?.hooks ?? {};
  let _status: DataCenterStatus = 'ready';
  let lastFlushAt: number | undefined;

  // ─── 持久化 ─────────────────────────────────────────

  /** 将内存数据库写入磁盘 */
  function doFlush(): void {
    if (_status === 'closed') return;
    saveDbToFile(ctx.raw, ctx.dbPath);
    lastFlushAt = Date.now();
    hooks.afterFlush?.();
  }

  // ─── immediate 模式：包装 repos 的 save 方法 ────────

  if (strategy === 'immediate') {
    wrapReposWithAutoFlush(repos, doFlush);
  }

  // ─── 定时 flush ─────────────────────────────────────

  let flushTimer: ReturnType<typeof setInterval> | undefined;
  if (flushInterval > 0 && strategy === 'manual') {
    flushTimer = setInterval(() => {
      try { doFlush(); } catch { /* 定时 flush 失败不中断 */ }
    }, flushInterval);
  }

  // ─── close ──────────────────────────────────────────

  let closePromise: Promise<void> | undefined;

  const close = async (): Promise<void> => {
    if (_status === 'closed') return;

    if (_status === 'closing') {
      // 等待正在进行的关闭完成
      return closePromise;
    }

    // beforeClose 钩子：返回 false 时抛出明确错误
    if (hooks.beforeClose) {
      const allowed = await hooks.beforeClose();
      if (!allowed) {
        throw new CloseError('数据中心关闭被 beforeClose 钩子阻止');
      }
    }

    _status = 'closing';

    closePromise = (async () => {
      try {
        // 停止定时 flush
        if (flushTimer !== undefined) {
          clearInterval(flushTimer);
          flushTimer = undefined;
        }
        // 带超时的同步关闭操作（doFlush + sql.js close）
        await withTimeout(() => {
          doFlush();
          ctx.raw.close();
        }, closeTimeout);

        _status = 'closed';
        await hooks.afterClose?.();
      } catch (err) {
        _status = 'closed';
        // 即使失败也调用 afterClose
        await hooks.afterClose?.();
        throw err instanceof CloseError ? err : new CloseError(
          `数据中心关闭失败: ${err instanceof Error ? err.message : String(err)}`,
          err,
        );
      }
    })();

    return closePromise;
  };

  // ─── 公开方法 ───────────────────────────────────────

  const dc: DataCenter = {
    repos,
    providers,
    exporter: new DataExporterImpl(repos.bars, repos.instruments),
    close: close,
    status: () => _status,
    isClosed: () => _status === 'closed',
    flush: doFlush,
    healthCheck: () => {
      const result: HealthCheckResult = {
        status: _status === 'ready' ? 'healthy' : 'unhealthy',
        dcStatus: _status,
        lastFlushAt,
      };
      if (_status !== 'ready') {
        result.error = `数据中心状态为 ${_status}，不可用`;
      }
      return result;
    },
    [Symbol.asyncDispose]: close,
  };

  return dc;
}

// ─── 内部工具 ───────────────────────────────────────────

/** 为 immediate 模式包装所有 repo 的 save 方法，写入后自动 flush */
function wrapReposWithAutoFlush(repos: RepositorySet, flush: () => void): void {
  for (const key of Object.keys(repos) as (keyof RepositorySet)[]) {
    const repo = repos[key] as unknown as Record<string, unknown>;
    if (typeof repo.save === 'function') {
      const originalSave = repo.save.bind(repo);
      repo.save = async (...args: unknown[]) => {
        const result = await originalSave(...args);
        flush();
        return result;
      };
    }
  }
}

/** 带超时的同步操作（通过 Promise.race） */
function withTimeout<T>(fn: () => T, ms: number): Promise<T> {
  if (ms <= 0) {
    return Promise.resolve(fn());
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new CloseError(`关闭超时 (${ms}ms)`));
    }, ms);
    try {
      const result = fn();
      clearTimeout(timer);
      resolve(result);
    } catch (err) {
      clearTimeout(timer);
      reject(err);
    }
  });
}
