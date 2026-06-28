"""RSI 策略"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyKind, StrategyParamDef, StrategyCategory, StrategySubcategory,
)
from ..indicators import rsi, last_valid


class RSIStrategy(Strategy):
    """RSI 策略：RSI < 30 买入，RSI > 70 卖出"""

    def __init__(self, period: int = 14, oversold: float = 30.0, overbought: float = 70.0) -> None:
        self._period = period
        self._oversold = oversold
        self._overbought = overbought
        self._prices: deque[float] = deque(maxlen=period + 2)
        self._bought = False

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="rsi",
            description="RSI 超买超卖策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="period", label="RSI 周期",
                                 type=ParamType.Number, default=self._period,
                                 min=2, max=50),
                StrategyParamDef(key="oversold", label="超卖阈值",
                                 type=ParamType.Number, default=self._oversold,
                                 min=10, max=50),
                StrategyParamDef(key="overbought", label="超买阈值",
                                 type=ParamType.Number, default=self._overbought,
                                 min=50, max=90),
            ],
            version="0.1.0",
            kind=StrategyKind.Timing,
            category=StrategyCategory.NON_FACTOR,
            subcategory=StrategySubcategory.TREND_CTA,
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._prices.clear()
        self._bought = False

    def on_bar(self, bar: Bar, context) -> None:
        self._prices.append(bar.close)

        if len(self._prices) < self._period + 1:
            return

        rsi_series = rsi(list(self._prices), self._period)
        rsi_value = last_valid(rsi_series)
        if rsi_value is None:
            return

        if rsi_value < self._oversold and not self._bought:
            account = context.get_account()
            qty = int(account.cash / bar.close)
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                    reason=f"RSI超卖：RSI={rsi_value:.2f}<{self._oversold}",
                ))
                self._bought = True
        elif rsi_value > self._overbought and self._bought:
            pos = context.get_position(bar.symbol)
            if pos and pos.quantity > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Sell,
                    type=OrderType.Market, quantity=int(pos.quantity),
                    reason=f"RSI超买：RSI={rsi_value:.2f}>{self._overbought}",
                ))
                self._bought = False

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
