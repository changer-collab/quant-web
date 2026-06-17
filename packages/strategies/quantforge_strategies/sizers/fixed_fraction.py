"""固定比例仓位策略 — 每次买入使用总资金的固定比例"""

from __future__ import annotations

from quantforge_strategy import (
    PositionStrategy, StrategyMeta, StrategyResult,
    Signal, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class FixedFractionSizer(PositionStrategy):
    """固定比例仓位策略。

    买入时：使用总资金的 fraction 比例买入。
    卖出时：目标数量为 0（清仓）。
    """

    def __init__(self, fraction: float = 0.1) -> None:
        self._fraction = fraction

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="fixed_fraction",
            description="固定比例仓位策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="fraction", label="资金比例",
                                 type=ParamType.Number, default=self._fraction,
                                 min=0.01, max=1.0),
            ],
            version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Sell:
            return 0.0

        account = context.get_account()
        allocated = account.equity * self._fraction
        return int(allocated / price)

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
