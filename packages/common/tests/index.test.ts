import { describe, it, expect } from 'vitest';
import {
  TimeFrame,
  OrderSide,
  OrderType,
  OrderStatus,
  ResearchMode,
  TaskStatus,
  TaskType,
  ParamType,
  DEFAULT_INITIAL_CASH,
  DEFAULT_SLIPPAGE,
} from '../src/index.js';
import type {
  Instrument,
  Bar,
  Order,
  BacktestConfig,
  BacktestMetrics,
  BacktestResult,
  StrategyParamDef,
} from '../src/index.js';

describe('枚举导出', () => {
  it('TimeFrame', () => {
    expect(TimeFrame.M1).toBe('1m');
    expect(TimeFrame.D1).toBe('1d');
  });

  it('OrderSide / OrderType / OrderStatus', () => {
    expect(OrderSide.Buy).toBe('buy');
    expect(OrderType.Limit).toBe('limit');
    expect(OrderStatus.Filled).toBe('filled');
  });

  it('ResearchMode / TaskStatus / TaskType', () => {
    expect(ResearchMode.Traditional).toBe('traditional');
    expect(TaskStatus.Running).toBe('running');
    expect(TaskType.Backtest).toBe('backtest');
  });

  it('ParamType', () => {
    expect(ParamType.Number).toBe('number');
    expect(ParamType.Select).toBe('select');
  });
});

describe('常量导出', () => {
  it('DEFAULT_INITIAL_CASH', () => {
    expect(DEFAULT_INITIAL_CASH).toBe(1_000_000);
  });

  it('DEFAULT_SLIPPAGE', () => {
    expect(DEFAULT_SLIPPAGE).toBe(0);
  });
});

describe('类型可构造性', () => {
  it('Instrument', () => {
    const inst: Instrument = {
      symbol: '000300.SH',
      name: '沪深300',
      exchange: 'SSE',
      lotSize: 1,
      priceTick: 0.01,
    };
    expect(inst.symbol).toBe('000300.SH');
  });

  it('Bar', () => {
    const bar: Bar = {
      symbol: '000300.SH',
      timeframe: TimeFrame.D1,
      timestamp: 1700000000000,
      open: 3800,
      high: 3850,
      low: 3790,
      close: 3840,
      volume: 100000,
    };
    expect(bar.close).toBe(3840);
  });

  it('Order', () => {
    const order: Order = {
      id: '1',
      symbol: '000300.SH',
      side: OrderSide.Buy,
      type: OrderType.Limit,
      price: 3840,
      quantity: 100,
      filledQty: 100,
      status: OrderStatus.Filled,
      timestamp: 1700000000000,
    };
    expect(order.side).toBe(OrderSide.Buy);
  });

  it('BacktestConfig + BacktestResult', () => {
    const config: BacktestConfig = {
      strategyName: 'dual_ma',
      mode: ResearchMode.Traditional,
      instruments: [],
      timeframe: TimeFrame.D1,
      startDate: 1700000000000,
      endDate: 1710000000000,
      initialCash: DEFAULT_INITIAL_CASH,
      slippage: DEFAULT_SLIPPAGE,
      params: { shortPeriod: 5, longPeriod: 20 },
    };
    const metrics: BacktestMetrics = {
      totalReturn: 0.15,
      annualizedReturn: 0.12,
      sharpeRatio: 1.5,
      maxDrawdown: 0.08,
      winRate: 0.55,
      totalTrades: 30,
    };
    const result: BacktestResult = {
      config,
      trades: [],
      equityCurve: [],
      metrics,
    };
    expect(result.metrics.totalReturn).toBe(0.15);
  });

  it('StrategyParamDef', () => {
    const param: StrategyParamDef = {
      key: 'shortPeriod',
      label: '短周期',
      type: ParamType.Number,
      default: 5,
      min: 1,
      max: 100,
    };
    expect(param.type).toBe(ParamType.Number);
  });
});
