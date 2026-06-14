import type { OrderSide, OrderType } from '@quant/common';

export enum StrategyState {
  Idle = 'idle',
  Running = 'running',
  Stopped = 'stopped',
  Error = 'error',
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
}
