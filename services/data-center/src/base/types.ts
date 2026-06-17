/** 时间周期 */
export enum TimeFrame {
  M1 = '1m',
  M5 = '5m',
  M15 = '15m',
  H1 = '1h',
  D1 = '1d',
}

/** 合约/标的元数据 */
export interface Instrument {
  symbol: string;
  name: string;
  exchange: string;
  lotSize: number;
  priceTick: number;
}

/** K线 */
export interface Bar {
  symbol: string;
  timeframe: TimeFrame;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Tick */
export interface Tick {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  bid: number;
  ask: number;
}

/** 行情事件 */
export interface MarketEvent {
  type: 'bar' | 'tick';
  data: Bar | Tick;
}

/** 研究模式 */
export enum ResearchMode {
  Traditional = 'traditional',
  HighFrequency = 'highFrequency',
  AI = 'ai',
}
