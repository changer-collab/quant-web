"""布林带策略"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyKind, StrategyParamDef, StrategyCategory, StrategySubcategory,
)
from ..indicators import bollinger, last_valid


class BollingerBandStrategy(Strategy):
    """布林带策略：价格跌破下轨买入，突破上轨卖出"""

    def __init__(self, period: int = 20, num_std: float = 2.0) -> None:
        self._period = period
        self._num_std = num_std
        self._prices: deque[float] = deque(maxlen=period + 1)
        self._bought = False

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="bollinger_band",
            description="布林带策略",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="period", label="周期",
                                 type=ParamType.Number, default=self._period,
                                 min=5, max=100),
                StrategyParamDef(key="num_std", label="标准差倍数",
                                 type=ParamType.Number, default=self._num_std,
                                 min=0.5, max=4.0),
            ],
            version="0.1.0",
            kind=StrategyKind.Timing,
            category=StrategyCategory.NON_FACTOR,
            subcategory=StrategySubcategory.TREND_CTA,
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._prices.clear()
        self._bought = False

    def on_bar(self, bar: Bar, context) -> None:
        self._prices.append(bar.close)

        if len(self._prices) < self._period:
            return

        middle, upper, lower = bollinger(list(self._prices), self._period, self._num_std)
        upper_val = last_valid(upper)
        lower_val = last_valid(lower)
        if upper_val is None or lower_val is None:
            return

        if bar.close <= lower_val and not self._bought:
            # 跌破下轨买入
            account = context.get_account()
            qty = int(account.cash / bar.close / 100) * 100
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                    reason=f"跌破布林下轨：close={bar.close:.2f}<=lower={lower_val:.2f}",
                ))
                self._bought = True
        elif bar.close >= upper_val and self._bought:
            # 突破上轨卖出
            pos = context.get_position(bar.symbol)
            if pos and pos.quantity > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Sell,
                    type=OrderType.Market, quantity=int(pos.quantity),
                    reason=f"突破布林上轨：close={bar.close:.2f}>=upper={upper_val:.2f}",
                ))
                self._bought = False

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
