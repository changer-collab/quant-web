"""选股策略基类 — 从候选池中选出目标股票"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .market import Bar
from .meta import StrategyMeta
from .result import StrategyResult


class SelectorStrategy(ABC):
    """选股策略基类。

    在每个调仓点从候选股票池中选出目标股票列表。
    不直接下单，只输出选股结果。
    子策略自行维护历史数据（在 select 中累积）。
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def select(self, bars: dict[str, Bar], context: StrategyContext) -> list[str]:
        """根据当前多标的行情选出股票池。

        Args:
            bars: 当前时刻各标的的最新 Bar，key 为 symbol
            context: 策略上下文
        Returns:
            选中的 symbol 列表
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
