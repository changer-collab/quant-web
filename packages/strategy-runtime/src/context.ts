import type { Position, Account } from '@quant/common';
import type { OrderRequest } from './types.js';

export type LogLevel = 'info' | 'warn' | 'error';

export interface StrategyContext {
  submitOrder(request: OrderRequest): void;
  getPosition(symbol: string): Position | undefined;
  getAllPositions(): Position[];
  getAccount(): Account;
  log(level: LogLevel, message: string, data?: unknown): void;
}
