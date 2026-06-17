"""组合策略基类 — 编排选股 + 择时 + 仓位管理"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .market import Bar
from .meta import StrategyMeta
from .result import StrategyResult
from .types import StrategyState


class CompositeStrategy(ABC):
    """组合策略基类。

    接收多标的行情（dict[symbol, Bar]），编排选股、择时和仓位管理。
    由 MultiSymbolRunner 驱动，不继承单标的 Strategy。
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @property
    @abstractmethod
    def state(self) -> StrategyState: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def on_bars(self, bars: dict[str, Bar], context: StrategyContext) -> None:
        """处理当前时间点的多标的行情。

        Args:
            bars: 当前时间点各标的的 Bar，key 为 symbol
            context: 策略上下文
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
