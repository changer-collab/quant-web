"""撮合引擎 — 根据行情数据匹配订单

支持 A 股市场规则：
- T+1 锁定：卖出时检查 available_qty
- 最小交易单位：买入数量取整为 100 股整数倍
"""

from __future__ import annotations

from quantforge_strategy import Order, Trade, Bar, OrderSide, OrderType, OrderStatus


class Matcher:
    def __init__(
        self,
        slippage: float = 0.0,
        market_rules=None,
    ) -> None:
        """初始化撮合器

        Args:
            slippage: 滑点（百分比，0.01 表示 1%）
            market_rules: 市场规则配置（MarketRules 实例，None 表示无规则）
        """
        self.slippage = slippage
        self.rules = market_rules

    def match(self, order: Order, bar: Bar, available_qty: float | None = None) -> Trade | None:
        """撮合订单

        Args:
            order: 订单
            bar: 当前行情
            available_qty: 可卖数量（T+1 检查用），None 表示不检查
        """
        if order.status != OrderStatus.Pending:
            return None

        # T+1 检查：卖出时检查可卖数量
        if (
            self.rules
            and self.rules.enable_t_plus_1
            and order.side == OrderSide.Sell
            and available_qty is not None
            and order.quantity > available_qty
        ):
            return None

        # 停牌不成交
        if getattr(bar, "is_suspended", False):
            return None

        # 涨跌停拦截：涨停不能买入，跌停不能卖出
        if order.side == OrderSide.Buy and getattr(bar, "is_limit_up", False):
            return None
        if order.side == OrderSide.Sell and getattr(bar, "is_limit_down", False):
            return None

        # 最小交易单位检查：买入数量须为 lot_size 整数倍
        if (
            self.rules
            and self.rules.enable_lot_size
            and order.side == OrderSide.Buy
            and order.quantity % self.rules.lot_size != 0
        ):
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
