import type { Instrument } from '../base/types.js';

/** 标的状态 */
export enum InstrumentStatus {
  Active = 'active',
  Suspended = 'suspended',
  Delisted = 'delisted',
}

/** 复权方向 */
export enum AdjustmentType {
  Forward = 'forward',
  Backward = 'backward',
}

/** 交易日历 */
export interface TradingCalendar {
  exchange: string;
  year: number;
  /** 交易日时间戳数组（毫秒，北京时间） */
  tradingDays: number[];
  /** 节假日时间戳数组（毫秒，北京时间） */
  holidays: number[];
  /** 交易时段类型（如 regular、half_day、extended） */
  sessionType?: string;
}

/** 扩展标的（含行业/上市日/状态） */
export interface ExtendedInstrument extends Instrument {
  /** 行业 */
  industry: string;
  /** 板块 */
  sector: string;
  /** 上市日期（毫秒时间戳） */
  listDate: number;
  /** 退市日期（毫秒时间戳，未退市则无） */
  delistDate?: number;
  /** 标的状态 */
  status: InstrumentStatus;
  /** 扩展属性（JSON，支持未来业务扩展） */
  attributes?: Record<string, unknown>;
}

/** 指数成分 */
export interface IndexComposition {
  /** 指数代码 */
  indexSymbol: string;
  /** 快照日期（毫秒时间戳） */
  asOfDate: number;
  /** 成分股列表 */
  constituents: IndexConstituent[];
}

/** 指数成分股 */
export interface IndexConstituent {
  symbol: string;
  /** 权重（0-1） */
  weight: number;
}

/** 复权因子 */
export interface AdjustmentFactor {
  symbol: string;
  /** 生效日期（毫秒时间戳） */
  date: number;
  /** 复权因子 */
  factor: number;
  /** 复权方向 */
  type: AdjustmentType;
}

/** 参考数据查询参数 */
export interface ReferenceQuery {
  exchange?: string;
  status?: InstrumentStatus;
  industry?: string;
  sector?: string;
}

/** 参考数据 Provider 接口 */
export interface ReferenceDataProvider {
  /** 获取交易日历 */
  getTradingCalendar(exchange: string, year: number): Promise<TradingCalendar>;
  /** 查询标的列表 */
  getInstruments(query?: ReferenceQuery): Promise<ExtendedInstrument[]>;
  /** 获取指数成分（按日期快照） */
  getIndexComposition(indexSymbol: string, asOfDate: number): Promise<IndexComposition>;
  /** 获取复权因子 */
  getAdjustmentFactors(symbol: string, start?: number, end?: number): Promise<AdjustmentFactor[]>;
  /** 是否交易日 */
  isTradingDay(exchange: string, date: number): Promise<boolean>;
  /** 获取上一交易日 */
  getPreviousTradingDay(exchange: string, date: number): Promise<number>;
}
