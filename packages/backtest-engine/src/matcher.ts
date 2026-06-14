import { OrderSide, OrderType, OrderStatus } from '@quant/common';
import type { Order, Bar, Trade } from '@quant/common';

/** 撮合引擎 — 根据行情数据匹配订单 */
export class Matcher {
  /**
   * @param slippage 滑点比例（如 0.01 表示 1%）
   */
  constructor(private slippage: number = 0) {}

  /** 尝试撮合订单，返回成交记录或 undefined */
  match(order: Order, bar: Bar): Trade | undefined {
    if (order.status !== OrderStatus.Pending) return undefined;

    let fillPrice: number | undefined;

    if (order.type === OrderType.Market) {
      fillPrice = order.side === OrderSide.Buy
        ? bar.close * (1 + this.slippage)
        : bar.close * (1 - this.slippage);
    } else if (order.type === OrderType.Limit && order.price !== undefined) {
      if (order.side === OrderSide.Buy && order.price >= bar.low) {
        fillPrice = order.price;
      } else if (order.side === OrderSide.Sell && order.price <= bar.high) {
        fillPrice = order.price;
      }
    }

    if (fillPrice === undefined) return undefined;

    return {
      id: `trade-${order.id}-${Date.now()}`,
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      price: Math.round(fillPrice * 100) / 100,
      quantity: order.quantity,
      timestamp: bar.timestamp,
    };
  }
}
