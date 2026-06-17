/** 盘口单档 */
export interface OrderBookEntry {
  price: number;
  volume: number;
  /** 委托笔数 */
  orderCount: number;
}

/** 成交方向 */
export enum TradeSide {
  Buy = 'buy',
  Sell = 'sell',
  Unknown = 'unknown',
}

/** 成交类型 */
export enum TradeType {
  Normal = 'normal',
  Block = 'block',
  Auction = 'auction',
}

/** 委托动作 */
export enum OrderAction {
  Add = 'add',
  Cancel = 'cancel',
  Trade = 'trade',
}

/** L2 委托类型 */
export enum L2OrderType {
  Limit = 'limit',
  Market = 'market',
}

/** 多档盘口快照 */
export interface Level2Snapshot {
  symbol: string;
  /** 快照时间（毫秒时间戳，北京时间） */
  timestamp: number;
  /** 买盘（按价格降序） */
  bids: OrderBookEntry[];
  /** 卖盘（按价格升序） */
  asks: OrderBookEntry[];
}

/** 逐笔成交 */
export interface TradeRecord {
  symbol: string;
  /** 成交时间（毫秒时间戳，北京时间） */
  timestamp: number;
  price: number;
  volume: number;
  side: TradeSide;
  tradeType: TradeType;
}

/** 逐笔委托 */
export interface OrderRecord {
  symbol: string;
  /** 委托时间（毫秒时间戳，北京时间） */
  timestamp: number;
  price: number;
  volume: number;
  action: OrderAction;
  orderType: L2OrderType;
}

/** L2 行情 Provider 接口 */
export interface Level2DataProvider {
  /** 流式返回盘口快照 */
  loadSnapshots(symbol: string, start?: number, end?: number): AsyncIterable<Level2Snapshot>;
  /** 流式返回逐笔成交 */
  loadTradeRecords(symbol: string, start?: number, end?: number): AsyncIterable<TradeRecord>;
  /** 流式返回逐笔委托 */
  loadOrderRecords(symbol: string, start?: number, end?: number): AsyncIterable<OrderRecord>;
  /** 获取最新盘口快照 */
  getLatestSnapshot(symbol: string): Promise<Level2Snapshot | undefined>;
}
