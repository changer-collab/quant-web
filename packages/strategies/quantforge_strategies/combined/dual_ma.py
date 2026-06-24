"""双均线策略"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyKind, StrategyParamDef,
)
from ..indicators import sma, crossover, crossunder, last_valid


class DualMAStrategy(Strategy):
    """双均线策略：短均线上穿长均线买入，下穿卖出"""

    def __init__(self, short_period: int = 5, long_period: int = 20) -> None:
        self._short_period = short_period
        self._long_period = long_period
        self._prices: deque[float] = deque(maxlen=long_period + 1)
        self._bought = False

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dual_ma",
            description="双均线策略",
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

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._prices.clear()
        self._bought = False

    def on_bar(self, bar: Bar, context) -> None:
        self._prices.append(bar.close)

        if len(self._prices) < self._long_period:
            return

        prices = list(self._prices)
        short_ma_series = sma(prices, self._short_period)
        long_ma_series = sma(prices, self._long_period)
        short_ma = last_valid(short_ma_series)
        long_ma = last_valid(long_ma_series)
        if short_ma is None or long_ma is None:
            return

        # 检测金叉/死叉（仅看最近一根 bar）
        golden_cross = crossover(short_ma_series, long_ma_series)[-1]
        death_cross = crossunder(short_ma_series, long_ma_series)[-1]

        if golden_cross and not self._bought:
            # 金叉买入
            account = context.get_account()
            qty = int(account.cash / bar.close)
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                    reason=f"金叉：短均线{short_ma:.2f}上穿长均线{long_ma:.2f}",
                ))
                self._bought = True
        elif death_cross and self._bought:
            # 死叉卖出
            pos = context.get_position(bar.symbol)
            if pos and pos.quantity > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Sell,
                    type=OrderType.Market, quantity=int(pos.quantity),
                    reason=f"死叉：短均线{short_ma:.2f}下穿长均线{long_ma:.2f}",
                ))
                self._bought = False

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
