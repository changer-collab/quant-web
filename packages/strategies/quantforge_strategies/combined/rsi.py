"""RSI 策略"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyKind, StrategyParamDef,
)


class RSIStrategy(Strategy):
    """RSI 策略：RSI < 30 买入，RSI > 70 卖出"""

    def __init__(self, period: int = 14, oversold: float = 30.0, overbought: float = 70.0) -> None:
        self._period = period
        self._oversold = oversold
        self._overbought = overbought
        self._gains: deque[float] = deque(maxlen=period)
        self._losses: deque[float] = deque(maxlen=period)
        self._prev_close: float | None = None
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
            kind=StrategyKind.Combined,
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._gains.clear()
        self._losses.clear()
        self._prev_close = None
        self._bought = False

    def _calc_rsi(self) -> float | None:
        if len(self._gains) < self._period:
            return None
        avg_gain = sum(self._gains) / self._period
        avg_loss = sum(self._losses) / self._period
        if avg_loss == 0:
            return 100.0
        rs = avg_gain / avg_loss
        return 100.0 - (100.0 / (1.0 + rs))

    def on_bar(self, bar: Bar, context) -> None:
        if self._prev_close is not None:
            change = bar.close - self._prev_close
            self._gains.append(max(change, 0.0))
            self._losses.append(max(-change, 0.0))
        self._prev_close = bar.close

        rsi = self._calc_rsi()
        if rsi is None:
            return

        if rsi < self._oversold and not self._bought:
            account = context.get_account()
            qty = int(account.cash / bar.close)
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                ))
                self._bought = True
        elif rsi > self._overbought and self._bought:
            pos = context.get_position(bar.symbol)
            if pos and pos.quantity > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Sell,
                    type=OrderType.Market, quantity=int(pos.quantity),
                ))
                self._bought = False

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
