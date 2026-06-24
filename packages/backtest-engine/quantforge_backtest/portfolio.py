"""持仓管理器 — 跟踪账户资金和持仓

支持 A 股市场规则：
- T+1 锁定：买入当日不可卖出，下一交易日解锁
- 交易成本：佣金、印花税、过户费
"""

from __future__ import annotations

from quantforge_strategy import Trade, Position, Account, OrderSide


class PortfolioManager:
    def __init__(
        self,
        initial_cash: float,
        market_rules=None,
    ) -> None:
        """初始化持仓管理器

        Args:
            initial_cash: 初始资金
            market_rules: 市场规则配置（MarketRules 实例，None 表示无规则）
        """
        self._initial_cash = initial_cash
        self._cash = initial_cash
        self._positions: dict[str, Position] = {}
        self._market_prices: dict[str, float] = {}
        self._rules = market_rules  # None 或 MarketRules 实例

    def apply_trade(self, trade: Trade) -> None:
        symbol = trade.symbol
        amount = trade.price * trade.quantity
        is_sell = trade.side == OrderSide.Sell

        # 计算交易成本
        cost = 0.0
        if self._rules is not None:
            cost = self._rules.calc_total_cost(amount, symbol, is_sell)

        if not is_sell:
            # 买入：扣除金额 + 成本
            self._cash -= amount + cost
            existing = self._positions.get(symbol)
            if existing:
                total_qty = existing.quantity + trade.quantity
                avg_price = (existing.avg_price * existing.quantity + trade.price * trade.quantity) / total_qty
                market_price = self._market_prices.get(symbol, trade.price)
                # T+1：买入当日 available_qty 不增加
                new_available = existing.available_qty
                self._positions[symbol] = Position(
                    symbol=symbol,
                    quantity=total_qty,
                    avg_price=round(avg_price, 2),
                    market_value=total_qty * market_price,
                    unrealized_pnl=(market_price - avg_price) * total_qty,
                    available_qty=new_available,
                )
            else:
                # 新建仓位：T+1 下 available_qty=0，否则等于 quantity
                new_available = 0.0 if (self._rules and self._rules.enable_t_plus_1) else trade.quantity
                self._positions[symbol] = Position(
                    symbol=symbol,
                    quantity=trade.quantity,
                    avg_price=trade.price,
                    market_value=trade.quantity * trade.price,
                    unrealized_pnl=0.0,
                    available_qty=new_available,
                )
                self._market_prices[symbol] = trade.price
        else:
            # 卖出：增加金额 - 成本
            self._cash += amount - cost
            existing = self._positions.get(symbol)
            if existing:
                remaining = existing.quantity - trade.quantity
                if remaining <= 0:
                    del self._positions[symbol]
                else:
                    market_price = self._market_prices.get(symbol, existing.avg_price)
                    # 卖出后 available_qty 同步减少
                    new_available = max(0.0, existing.available_qty - trade.quantity)
                    self._positions[symbol] = Position(
                        symbol=symbol,
                        quantity=remaining,
                        avg_price=existing.avg_price,
                        market_value=remaining * market_price,
                        unrealized_pnl=(market_price - existing.avg_price) * remaining,
                        available_qty=new_available,
                    )

    def update_market_price(self, symbol: str, price: float) -> None:
        self._market_prices[symbol] = price
        pos = self._positions.get(symbol)
        if pos:
            self._positions[symbol] = Position(
                symbol=symbol,
                quantity=pos.quantity,
                avg_price=pos.avg_price,
                market_value=pos.quantity * price,
                unrealized_pnl=(price - pos.avg_price) * pos.quantity,
                available_qty=pos.available_qty,
            )

    def unlock_t_plus_1(self, symbol: str | None = None) -> None:
        """解锁 T+1 持仓（在新交易日开盘时调用）

        将指定标的（或全部持仓）的 available_qty 设为 quantity。
        """
        symbols = [symbol] if symbol else list(self._positions.keys())
        for sym in symbols:
            pos = self._positions.get(sym)
            if pos and pos.available_qty < pos.quantity:
                self._positions[sym] = Position(
                    symbol=pos.symbol,
                    quantity=pos.quantity,
                    avg_price=pos.avg_price,
                    market_value=pos.market_value,
                    unrealized_pnl=pos.unrealized_pnl,
                    available_qty=pos.quantity,
                )

    def get_position(self, symbol: str) -> Position | None:
        return self._positions.get(symbol)

    def get_all_positions(self) -> list[Position]:
        return list(self._positions.values())

    def get_account(self) -> Account:
        position_value = sum(p.market_value for p in self._positions.values())
        return Account(
            initial_cash=self._initial_cash,
            cash=self._cash,
            equity=self._cash + position_value,
            positions=dict(self._positions),
        )
