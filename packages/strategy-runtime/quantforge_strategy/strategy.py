"""策略抽象基类"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .market import Bar, Tick
from .meta import StrategyMeta
from .order import Order
from .result import StrategyResult
from .types import StrategyState


class Strategy(ABC):
    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @property
    @abstractmethod
    def state(self) -> StrategyState: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def on_bar(self, bar: Bar, context: StrategyContext) -> None: ...

    def on_tick(self, tick: Tick, context: StrategyContext) -> None:
        pass

    def on_order(self, order: Order, context: StrategyContext) -> None:
        pass

    @abstractmethod
    def finish(self) -> StrategyResult: ...
