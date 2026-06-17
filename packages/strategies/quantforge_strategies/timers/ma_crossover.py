"""均线交叉择时策略 — 短均线上穿长均线买入，下穿卖出"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    TimingStrategy, StrategyMeta, StrategyResult,
    Bar, Signal, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class MACrossoverTiming(TimingStrategy):
    """均线交叉择时策略。

    短均线上穿长均线（金叉）输出 Buy，
    短均线下穿长均线（死叉）输出 Sell，
    其他情况输出 Hold。
    """

    def __init__(self, short_period: int = 5, long_period: int = 20) -> None:
        self._short_period = short_period
        self._long_period = long_period
        self._prices: deque[float] = deque(maxlen=long_period + 1)
        self._prev_short_above: bool | None = None

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="ma_crossover",
            description="均线交叉择时策略",
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
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        self._prices.clear()
        self._prev_short_above = None

    def signal(self, bar: Bar, context) -> Signal:
        self._prices.append(bar.close)

        if len(self._prices) < self._long_period:
            return Signal.Hold

        prices = list(self._prices)
        short_ma = sum(prices[-self._short_period:]) / self._short_period
        long_ma = sum(prices[-self._long_period:]) / self._long_period
        short_above = short_ma > long_ma

        result = Signal.Hold

        if self._prev_short_above is not None:
            if short_above and not self._prev_short_above:
                result = Signal.Buy
            elif not short_above and self._prev_short_above:
                result = Signal.Sell

        self._prev_short_above = short_above
        return result

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
