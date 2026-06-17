"""择时策略基类 — 对单只股票输出买卖信号"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .market import Bar
from .meta import StrategyMeta
from .result import StrategyResult
from .types import Signal


class TimingStrategy(ABC):
    """择时策略基类。

    对给定标的的 Bar 输出买卖信号（Buy/Sell/Hold）。
    不直接下单，只输出信号。
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def signal(self, bar: Bar, context: StrategyContext) -> Signal:
        """对单根 bar 输出交易信号。

        Args:
            bar: 当前标的的行情
            context: 策略上下文
        Returns:
            Signal.Buy / Signal.Sell / Signal.Hold
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
