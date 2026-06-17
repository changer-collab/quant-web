"""仓位管理策略基类 — 根据信号和账户状态输出目标持仓数量"""

from __future__ import annotations

from abc import ABC, abstractmethod

from .context import StrategyContext
from .meta import StrategyMeta
from .result import StrategyResult
from .types import Signal


class PositionStrategy(ABC):
    """仓位管理策略基类。

    根据交易信号、当前价格和账户状态，输出目标持仓数量。
    不直接下单，只输出数量建议。

    约定：
    - Buy 信号时，size 返回"买入后应持有的目标总数量"
    - Sell 信号时，size 返回"卖出后应剩余的目标数量"（0 表示清仓）
    """

    @property
    @abstractmethod
    def meta(self) -> StrategyMeta: ...

    @abstractmethod
    def init(self, context: StrategyContext) -> None: ...

    @abstractmethod
    def size(
        self,
        symbol: str,
        signal: Signal,
        price: float,
        context: StrategyContext,
    ) -> float:
        """计算目标持仓数量。

        Args:
            symbol: 标的代码
            signal: 交易信号（Buy/Sell）
            price: 当前价格
            context: 策略上下文
        Returns:
            目标持仓数量（正数）
        """
        ...

    @abstractmethod
    def finish(self) -> StrategyResult: ...
