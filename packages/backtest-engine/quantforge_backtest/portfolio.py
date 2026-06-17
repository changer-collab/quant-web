"""持仓管理器 — 跟踪账户资金和持仓"""

from __future__ import annotations

from dataclasses import dataclass, field

from quantforge_strategy import Trade, Position, Account, OrderSide


class PortfolioManager:
    def __init__(self, initial_cash: float) -> None:
        self._initial_cash = initial_cash
        self._cash = initial_cash
        self._positions: dict[str, Position] = {}
        self._market_prices: dict[str, float] = {}

    def apply_trade(self, trade: Trade) -> None:
        symbol = trade.symbol
        amount = trade.price * trade.quantity

        if trade.side == OrderSide.Buy:
            self._cash -= amount
            existing = self._positions.get(symbol)
            if existing:
                total_qty = existing.quantity + trade.quantity
                avg_price = (existing.avg_price * existing.quantity + trade.price * trade.quantity) / total_qty
                market_price = self._market_prices.get(symbol, trade.price)
                self._positions[symbol] = Position(
                    symbol=symbol,
                    quantity=total_qty,
                    avg_price=round(avg_price, 2),
                    market_value=total_qty * market_price,
                    unrealized_pnl=(market_price - avg_price) * total_qty,
                )
            else:
                self._positions[symbol] = Position(
                    symbol=symbol,
                    quantity=trade.quantity,
                    avg_price=trade.price,
                    market_value=trade.quantity * trade.price,
                    unrealized_pnl=0.0,
                )
                self._market_prices[symbol] = trade.price
        else:
            self._cash += amount
            existing = self._positions.get(symbol)
            if existing:
                remaining = existing.quantity - trade.quantity
                if remaining <= 0:
                    del self._positions[symbol]
                else:
                    market_price = self._market_prices.get(symbol, existing.avg_price)
                    self._positions[symbol] = Position(
                        symbol=symbol,
                        quantity=remaining,
                        avg_price=existing.avg_price,
                        market_value=remaining * market_price,
                        unrealized_pnl=(market_price - existing.avg_price) * remaining,
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
