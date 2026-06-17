"""动量选股策略 — 选过去 N 日涨幅最大的 K 只股票"""

from __future__ import annotations

from quantforge_strategy import (
    SelectorStrategy, StrategyMeta, StrategyResult,
    Bar, ParamType, ResearchMode, StrategyKind,
)
from quantforge_strategy import StrategyParamDef


class MomentumSelector(SelectorStrategy):
    """动量选股策略。

    在每个调仓点，计算各标的过去 lookback 根 bar 的涨幅，
    选出涨幅最高的 top_k 只股票。
    """

    def __init__(self, lookback: int = 20, top_k: int = 5) -> None:
        self._lookback = lookback
        self._top_k = top_k
        self._history: dict[str, list[Bar]] = {}

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="momentum_selector",
            description="动量选股策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="lookback", label="回看周期",
                                 type=ParamType.Number, default=self._lookback,
                                 min=2, max=100),
                StrategyParamDef(key="top_k", label="选股数量",
                                 type=ParamType.Number, default=self._top_k,
                                 min=1, max=50),
            ],
            version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        self._history.clear()

    def select(self, bars: dict[str, Bar], context) -> list[str]:
        # 累积历史
        for symbol, bar in bars.items():
            if symbol not in self._history:
                self._history[symbol] = []
            self._history[symbol].append(bar)

        # 计算动量（过去 lookback 根 bar 的涨幅）
        momentum: dict[str, float] = {}
        for symbol, history in self._history.items():
            if len(history) >= self._lookback:
                start_price = history[-self._lookback].close
                current_price = history[-1].close
                if start_price > 0:
                    momentum[symbol] = (current_price - start_price) / start_price

        if not momentum:
            return []

        # 按动量降序排列，取 top_k
        sorted_symbols = sorted(momentum.items(), key=lambda x: x[1], reverse=True)
        return [s for s, _ in sorted_symbols[:self._top_k]]

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
