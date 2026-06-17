"""双均线策略"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
)
from quantforge_strategy import StrategyParamDef


class DualMAStrategy(Strategy):
    """双均线策略：短均线上穿长均线买入，下穿卖出"""

    def __init__(self, short_period: int = 5, long_period: int = 20) -> None:
        self._short_period = short_period
        self._long_period = long_period
        self._prices: deque[float] = deque(maxlen=long_period + 1)
        self._prev_short_above: bool | None = None
        self._bought = False

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dual_ma",
            description="双均线策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="short_period", label="短均线周期",
                                 type=ParamType.Number, default=self._short_period,
                                 min=2, max=50),
                StrategyParamDef(key="long_period", label="长均线周期",
                                 type=ParamType.Number, default=self._long_period,
                                 min=5, max=200),
            ],
            version="0.1.0",
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._prices.clear()
        self._prev_short_above = None
        self._bought = False

    def on_bar(self, bar: Bar, context) -> None:
        self._prices.append(bar.close)

        if len(self._prices) < self._long_period:
            return

        prices = list(self._prices)
        short_ma = sum(prices[-self._short_period:]) / self._short_period
        long_ma = sum(prices[-self._long_period:]) / self._long_period
        short_above = short_ma > long_ma

        if self._prev_short_above is not None:
            if short_above and not self._prev_short_above and not self._bought:
                # 金叉买入
                account = context.get_account()
                qty = int(account.cash / bar.close)
                if qty > 0:
                    context.submit_order(OrderRequest(
                        symbol=bar.symbol, side=OrderSide.Buy,
                        type=OrderType.Market, quantity=qty,
                    ))
                    self._bought = True
            elif not short_above and self._prev_short_above and self._bought:
                # 死叉卖出
                pos = context.get_position(bar.symbol)
                if pos and pos.quantity > 0:
                    context.submit_order(OrderRequest(
                        symbol=bar.symbol, side=OrderSide.Sell,
                        type=OrderType.Market, quantity=int(pos.quantity),
                    ))
                    self._bought = False

        self._prev_short_above = short_above

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
