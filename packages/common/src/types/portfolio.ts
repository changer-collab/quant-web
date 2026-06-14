/** 成交记录 */
export interface Trade {
  id: string;
  orderId: string;
  symbol: string;
  side: import('./order').OrderSide;
  price: number;
  quantity: number;
  timestamp: number;
}

/** 持仓 */
export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  marketValue: number;
  unrealizedPnl: number;
}

/** 账户 */
export interface Account {
  initialCash: number;
  cash: number;
  equity: number;
  positions: Map<string, Position>;
}
