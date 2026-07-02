import { TimeFrame } from '../base/types.js';
import type { Bar, Tick } from '../base/types.js';
import type { PageParams, PageResult } from '../repository/types.js';

/** 扩展 K 线（补 turnover / openInterest / numTrades） */
export interface ExtendedBar extends Bar {
  /** 成交额 */
  turnover: number;
  /** 持仓量（期货适用） */
  openInterest?: number;
  /** 成交笔数 */
  numTrades?: number;
}

/** 扩展 Tick（补 bidVolume / askVolume / bidOrders / askOrders） */
export interface ExtendedTick extends Tick {
  /** 买一量 */
  bidVolume: number;
  /** 卖一量 */
  askVolume: number;
  /** 买一委托笔数 */
  bidOrders?: number;
  /** 卖一委托笔数 */
  askOrders?: number;
}

/** L1 行情查询参数 */
export interface MarketDataQuery {
  symbol: string;
  timeframe: TimeFrame;
  start?: number;
  end?: number;
}

/** L1 行情 Provider 接口 */
export interface MarketDataProvider {
  /** 流式返回 K 线 */
  loadBars(
    symbol: string,
    timeframe: TimeFrame,
    start?: number,
    end?: number
  ): AsyncIterable<ExtendedBar>;
  /** 流式返回 Tick */
  loadTicks(symbol: string, start?: number, end?: number): AsyncIterable<ExtendedTick>;
  /** 获取最新 K 线 */
  getLatestBar(symbol: string, timeframe: TimeFrame): Promise<ExtendedBar | undefined>;
  /** 获取可用标的列表 */
  getAvailableSymbols(timeframe?: TimeFrame): Promise<string[]>;
  /** 分页查询 K 线（cursor 方式） */
  getBarsPaged(
    symbol: string,
    timeframe: TimeFrame,
    params?: PageParams
  ): Promise<PageResult<ExtendedBar>>;
}
