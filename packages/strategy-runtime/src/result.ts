import type { Order, Trade } from '@quant/common';
import type { StrategyMeta } from './meta.js';

export interface StrategyResult {
  meta: StrategyMeta;
  orders: Order[];
  trades: Trade[];
  customOutput?: Record<string, unknown>;
}
