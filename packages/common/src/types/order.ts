/** 订单方向 */
export enum OrderSide {
  Buy = 'buy',
  Sell = 'sell',
}

/** 订单类型 */
export enum OrderType {
  Market = 'market',
  Limit = 'limit',
}

/** 订单状态 */
export enum OrderStatus {
  Pending = 'pending',
  Filled = 'filled',
  Canceled = 'canceled',
  Rejected = 'rejected',
}

/** 订单 */
export interface Order {
  id: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price?: number;
  quantity: number;
  filledQty: number;
  status: OrderStatus;
  timestamp: number;
}
