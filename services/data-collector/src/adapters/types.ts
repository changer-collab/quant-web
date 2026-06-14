import type { CollectorDomain } from '../types.js';

/** Tushare 适配器额外参数 */
export interface TushareExtra {
  /** Tushare Pro API Token（必填） */
  token: string;
}

/** AKShare 适配器额外参数 */
export interface AkshareExtra {
  /** Python 可执行文件路径，默认 python3 */
  pythonPath?: string;
}

/** CSV 适配器额外参数 */
export interface CsvExtra {
  /** CSV 文件路径 */
  filePath: string;
  /** 分隔符，默认逗号 */
  delimiter?: string;
  /** 编码，默认 utf-8 */
  encoding?: string;
}

/** Baostock 适配器额外参数 */
export interface BaostockExtra {
  /** Python 可执行文件路径，默认 python3 */
  pythonPath?: string;
}

/** Efinance 适配器额外参数 */
export interface EfinanceExtra {
  /** Python 可执行文件路径，默认 python3 */
  pythonPath?: string;
}

/** Yfinance 适配器额外参数 */
export interface YfinanceExtra {
  /** Python 可执行文件路径，默认 python3 */
  pythonPath?: string;
}

/** 所有适配器 extra 类型的联合 */
export type AdapterExtra = TushareExtra | AkshareExtra | CsvExtra | BaostockExtra | EfinanceExtra | YfinanceExtra | Record<string, unknown>;

/** 适配器拉取选项 */
export interface AdapterFetchOptions {
  domain: CollectorDomain | string;
  dataType: string;
  symbol: string;
  timeframe?: string;
  start?: number;
  end?: number;
  /** 适配器特定参数（类型安全：TushareExtra / AkshareExtra / CsvExtra） */
  extra?: AdapterExtra;
  /** 日期字段格式，默认 'auto'。设为 'yyyymmdd' 或 'timestamp' 可避免启发式误判 */
  dateFormat?: 'auto' | 'yyyymmdd' | 'timestamp';
}

/** 原始数据记录 — 键值对，待清洗 */
export type RawDataRecord = Record<string, unknown>;

/** 数据源适配器接口 — 所有适配器必须实现 */
export interface DataSourceAdapter {
  /** 适配器名称（唯一标识） */
  name: string;

  /** 支持的数据子域 */
  supportedDomains: string[];

  /** 支持的数据类型（如 bar、tick、instrument） */
  supportedDataTypes: string[];

  /**
   * 从数据源拉取原始数据 — 流式返回
   * 调用方通过 for-await-of 逐条消费，降低内存压力
   */
  fetch(options: AdapterFetchOptions): AsyncIterable<RawDataRecord>;
}
