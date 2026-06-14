import { OrderSide } from '@quant/common';
import type { Trade, Position, Account } from '@quant/common';

/** 持仓管理器 — 跟踪账户资金和持仓 */
export class Portfolio {
  private cash: number;
  private readonly initialCash: number;
  private readonly positions = new Map<string, Position>();
  private readonly marketPrices = new Map<string, number>();

  constructor(initialCash: number) {
    this.cash = initialCash;
    this.initialCash = initialCash;
  }

  /** 应用成交，更新持仓和现金 */
  applyTrade(trade: Trade): void {
    const { symbol, side, price, quantity } = trade;
    const amount = price * quantity;

    if (side === OrderSide.Buy) {
      this.cash -= amount;
      const existing = this.positions.get(symbol);
      if (existing) {
        const totalQuantity = existing.quantity + quantity;
        const avgPrice = (existing.avgPrice * existing.quantity + price * quantity) / totalQuantity;
        const marketPrice = this.marketPrices.get(symbol) ?? price;
        this.positions.set(symbol, {
          symbol,
          quantity: totalQuantity,
          avgPrice: Math.round(avgPrice * 100) / 100,
          marketValue: totalQuantity * marketPrice,
          unrealizedPnl: (marketPrice - avgPrice) * totalQuantity,
        });
      } else {
        this.positions.set(symbol, {
          symbol,
          quantity,
          avgPrice: price,
          marketValue: quantity * price,
          unrealizedPnl: 0,
        });
        this.marketPrices.set(symbol, price);
      }
    } else {
      this.cash += amount;
      const existing = this.positions.get(symbol);
      if (existing) {
        const remaining = existing.quantity - quantity;
        if (remaining <= 0) {
          this.positions.delete(symbol);
        } else {
          const marketPrice = this.marketPrices.get(symbol) ?? existing.avgPrice;
          this.positions.set(symbol, {
            symbol,
            quantity: remaining,
            avgPrice: existing.avgPrice,
            marketValue: remaining * marketPrice,
            unrealizedPnl: (marketPrice - existing.avgPrice) * remaining,
          });
        }
      }
    }
  }

  /** 更新市价，刷新持仓市值和权益 */
  updateMarketPrice(symbol: string, price: number): void {
    this.marketPrices.set(symbol, price);
    const pos = this.positions.get(symbol);
    if (pos) {
      this.positions.set(symbol, {
        ...pos,
        marketValue: pos.quantity * price,
        unrealizedPnl: (price - pos.avgPrice) * pos.quantity,
      });
    }
  }

  /** 获取指定标的持仓 */
  getPosition(symbol: string): Position | undefined {
    return this.positions.get(symbol);
  }

  /** 获取所有持仓 */
  getAllPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /** 获取账户信息 */
  getAccount(): Account {
    let positionValue = 0;
    for (const pos of this.positions.values()) {
      positionValue += pos.marketValue;
    }
    return {
      initialCash: this.initialCash,
      cash: this.cash,
      equity: this.cash + positionValue,
      positions: this.positions,
    };
  }
}
