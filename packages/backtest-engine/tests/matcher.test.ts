import { describe, it, expect } from 'vitest';
import { Matcher } from '../src/matcher.js';
import { OrderSide, OrderType, OrderStatus, TimeFrame } from '@quant/common';
import type { Order, Bar } from '@quant/common';

function makeBar(close: number, high?: number, low?: number): Bar {
  return {
    symbol: 'CSI500',
    timeframe: TimeFrame.D1,
    timestamp: 1000,
    open: close - 5,
    high: high ?? close + 10,
    low: low ?? close - 10,
    close,
    volume: 100000,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    symbol: 'CSI500',
    side: OrderSide.Buy,
    type: OrderType.Market,
    quantity: 100,
    filledQty: 0,
    status: OrderStatus.Pending,
    timestamp: 1000,
    ...overrides,
  };
}

describe('Matcher', () => {
  it('市价买单按 close + slippage 成交', () => {
    const matcher = new Matcher(0.01);
    const bar = makeBar(5000);
    const order = makeOrder({ side: OrderSide.Buy, type: OrderType.Market });
    const trade = matcher.match(order, bar);
    expect(trade).toBeDefined();
    expect(trade!.price).toBe(5050); // 5000 * (1 + 0.01)
    expect(trade!.quantity).toBe(100);
    expect(trade!.side).toBe(OrderSide.Buy);
  });

  it('市价卖单按 close - slippage 成交', () => {
    const matcher = new Matcher(0.01);
    const bar = makeBar(5000);
    const order = makeOrder({ side: OrderSide.Sell, type: OrderType.Market });
    const trade = matcher.match(order, bar);
    expect(trade).toBeDefined();
    expect(trade!.price).toBe(4950); // 5000 * (1 - 0.01)
  });

  it('限价买单价格 >= low 时成交', () => {
    const matcher = new Matcher(0);
    const bar = makeBar(5000, 5050, 4950);
    const order = makeOrder({ side: OrderSide.Buy, type: OrderType.Limit, price: 4960 });
    const trade = matcher.match(order, bar);
    expect(trade).toBeDefined();
    expect(trade!.price).toBe(4960);
  });

  it('限价买单价格 < low 不成交', () => {
    const matcher = new Matcher(0);
    const bar = makeBar(5000, 5050, 4950);
    const order = makeOrder({ side: OrderSide.Buy, type: OrderType.Limit, price: 4900 });
    const trade = matcher.match(order, bar);
    expect(trade).toBeUndefined();
  });

  it('限价卖单价格 <= high 时成交', () => {
    const matcher = new Matcher(0);
    const bar = makeBar(5000, 5050, 4950);
    const order = makeOrder({ side: OrderSide.Sell, type: OrderType.Limit, price: 5040 });
    const trade = matcher.match(order, bar);
    expect(trade).toBeDefined();
    expect(trade!.price).toBe(5040);
  });

  it('限价卖单价格 > high 不成交', () => {
    const matcher = new Matcher(0);
    const bar = makeBar(5000, 5050, 4950);
    const order = makeOrder({ side: OrderSide.Sell, type: OrderType.Limit, price: 5100 });
    const trade = matcher.match(order, bar);
    expect(trade).toBeUndefined();
  });

  it('非 Pending 状态不撮合', () => {
    const matcher = new Matcher(0);
    const bar = makeBar(5000);
    const order = makeOrder({ status: OrderStatus.Filled });
    const trade = matcher.match(order, bar);
    expect(trade).toBeUndefined();
  });

  it('零滑点时按 close 成交', () => {
    const matcher = new Matcher(0);
    const bar = makeBar(5000);
    const order = makeOrder({ side: OrderSide.Buy, type: OrderType.Market });
    const trade = matcher.match(order, bar);
    expect(trade!.price).toBe(5000);
  });
});
