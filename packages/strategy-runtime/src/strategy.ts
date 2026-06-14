import type { Bar, Tick, Order } from '@quant/common';
import type { StrategyMeta } from './meta.js';
import type { StrategyContext } from './context.js';
import type { StrategyResult } from './result.js';
import type { StrategyState } from './types.js';

export interface Strategy {
  readonly meta: StrategyMeta;
  readonly state: StrategyState;
  init(context: StrategyContext): void;
  onBar(bar: Bar, context: StrategyContext): void;
  onTick?(tick: Tick, context: StrategyContext): void;
  onOrder?(order: Order, context: StrategyContext): void;
  finish(): StrategyResult;
}
