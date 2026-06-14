// types — re-export base types from data-center
export { TimeFrame } from '@quant/data-center';
export type { Instrument, Bar, Tick } from '@quant/data-center';

export type { MarketEvent } from './types/market.js';

export { OrderSide, OrderType, OrderStatus } from './types/order.js';
export type { Order } from './types/order.js';

export type { Trade, Position, Account } from './types/portfolio.js';

export { ResearchMode, TaskStatus, TaskType } from './types/task.js';
export type { BacktestConfig, BacktestMetrics, EquityPoint, BacktestResult } from './types/task.js';

export { ParamType } from './types/strategy.js';
export type { StrategyParamDef } from './types/strategy.js';

// factor
export { FactorEvalTab, FactorStatus } from './types/factor.js';
export type {
  FactorDefinition,
  FactorEvaluationResult,
  FactorMetrics,
  FactorRow,
} from './types/factor.js';

// errors
export { QuantError } from './errors.js';

// constants
export { DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE } from './constants.js';
