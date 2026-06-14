import { describe, it, expect } from 'vitest';
import { Portfolio } from '../src/portfolio.js';
import { OrderSide } from '@quant/common';
import type { Trade } from '@quant/common';

function makeTrade(side: OrderSide, price: number, quantity: number, symbol = 'CSI500'): Trade {
  return {
    id: `trade-${Date.now()}`,
    orderId: 'ord-1',
    symbol,
    side,
    price,
    quantity,
    timestamp: 1000,
  };
}

describe('Portfolio', () => {
  it('初始账户状态', () => {
    const portfolio = new Portfolio(1_000_000);
    const account = portfolio.getAccount();
    expect(account.cash).toBe(1_000_000);
    expect(account.equity).toBe(1_000_000);
    expect(account.positions.size).toBe(0);
  });

  it('买入建仓', () => {
    const portfolio = new Portfolio(1_000_000);
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 5000, 100));
    const pos = portfolio.getPosition('CSI500');
    expect(pos).toBeDefined();
    expect(pos!.quantity).toBe(100);
    expect(pos!.avgPrice).toBe(5000);
    expect(portfolio.getAccount().cash).toBe(500_000);
  });

  it('卖出减仓', () => {
    const portfolio = new Portfolio(1_000_000);
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 5000, 100));
    portfolio.applyTrade(makeTrade(OrderSide.Sell, 5200, 50));
    const pos = portfolio.getPosition('CSI500');
    expect(pos!.quantity).toBe(50);
    expect(pos!.avgPrice).toBe(5000);
    expect(portfolio.getAccount().cash).toBe(760_000); // 500000 + 5200*50
  });

  it('全部卖出删除持仓', () => {
    const portfolio = new Portfolio(1_000_000);
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 5000, 100));
    portfolio.applyTrade(makeTrade(OrderSide.Sell, 5200, 100));
    expect(portfolio.getPosition('CSI500')).toBeUndefined();
  });

  it('加仓更新均价', () => {
    const portfolio = new Portfolio(1_000_000);
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 5000, 100));
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 5200, 100));
    const pos = portfolio.getPosition('CSI500');
    expect(pos!.quantity).toBe(200);
    expect(pos!.avgPrice).toBe(5100); // (5000*100 + 5200*100) / 200
  });

  it('updateMarketPrice 更新市值和权益', () => {
    const portfolio = new Portfolio(1_000_000);
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 5000, 100));
    portfolio.updateMarketPrice('CSI500', 5200);
    const account = portfolio.getAccount();
    expect(account.equity).toBe(1_020_000); // 500000 + 5200*100
    const pos = portfolio.getPosition('CSI500');
    expect(pos!.marketValue).toBe(520_000);
    expect(pos!.unrealizedPnl).toBe(20_000);
  });

  it('多标的持仓', () => {
    const portfolio = new Portfolio(2_000_000);
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 5000, 100, 'CSI500'));
    portfolio.applyTrade(makeTrade(OrderSide.Buy, 30, 1000, 'HS300'));
    expect(portfolio.getAllPositions()).toHaveLength(2);
  });
});
