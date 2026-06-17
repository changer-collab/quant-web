"""撮合引擎 — 根据行情数据匹配订单"""

from __future__ import annotations

from quantforge_strategy import Order, Trade, Bar, OrderSide, OrderType, OrderStatus


class Matcher:
    def __init__(self, slippage: float = 0.0) -> None:
        self.slippage = slippage

    def match(self, order: Order, bar: Bar) -> Trade | None:
        if order.status != OrderStatus.Pending:
            return None

        fill_price: float | None = None

        if order.type == OrderType.Market:
            if order.side == OrderSide.Buy:
                fill_price = bar.close * (1 + self.slippage)
            else:
                fill_price = bar.close * (1 - self.slippage)
        elif order.type == OrderType.Limit and order.price is not None:
            if order.side == OrderSide.Buy and order.price >= bar.low:
                fill_price = order.price
            elif order.side == OrderSide.Sell and order.price <= bar.high:
                fill_price = order.price

        if fill_price is None:
            return None

        fill_price = round(fill_price, 2)

        return Trade(
            id=f"trade-{order.id}-{bar.timestamp}",
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            price=fill_price,
            quantity=order.quantity,
            timestamp=bar.timestamp,
        )
