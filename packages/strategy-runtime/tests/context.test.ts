import { describe, it, expect } from 'vitest';
import type { StrategyContext } from '../src/context.js';
import type { OrderRequest } from '../src/types.js';
import { OrderSide, OrderType } from '@quant/common';

describe('StrategyContext', () => {
  it('submitOrder 记录订单请求', () => {
    const orders: OrderRequest[] = [];
    const context: StrategyContext = {
      submitOrder: (req) => orders.push(req),
      getPosition: () => undefined,
      getAllPositions: () => [],
      getAccount: () => ({ initialCash: 1_000_000, cash: 1_000_000, equity: 1_000_000, positions: new Map() }),
      log: () => {},
    };
    context.submitOrder({ symbol: 'CSI500', side: OrderSide.Buy, type: OrderType.Market, quantity: 1 });
    expect(orders).toHaveLength(1);
    expect(orders[0].symbol).toBe('CSI500');
  });
});
