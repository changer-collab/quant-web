"""等权仓位策略 — 每只股票分配相等的资金"""

from __future__ import annotations

from quantforge_strategy import (
    PositionStrategy, StrategyMeta, StrategyResult,
    Signal, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class EqualWeightSizer(PositionStrategy):
    """等权仓位策略。

    买入时：将总资金按 max_positions 等分，每只股票分配 1/max_positions 的资金。
    卖出时：目标数量为 0（清仓）。
    """

    def __init__(self, max_positions: int = 5) -> None:
        self._max_positions = max_positions

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="equal_weight",
            description="等权仓位策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="max_positions", label="最大持仓数",
                                 type=ParamType.Number, default=self._max_positions,
                                 min=1, max=50),
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
        per_stock_cash = account.equity / self._max_positions
        return int(per_stock_cash / price)

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
