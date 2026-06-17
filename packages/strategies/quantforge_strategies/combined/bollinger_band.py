"""布林带策略"""

from __future__ import annotations

from collections import deque
import math

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
)
from quantforge_strategy import StrategyParamDef


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

        prices = list(self._prices)[-self._period:]
        ma = sum(prices) / len(prices)
        variance = sum((p - ma) ** 2 for p in prices) / len(prices)
        std = math.sqrt(variance)
        upper = ma + self._num_std * std
        lower = ma - self._num_std * std

        if bar.close <= lower and not self._bought:
            # 跌破下轨买入
            account = context.get_account()
            qty = int(account.cash / bar.close)
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                ))
                self._bought = True
        elif bar.close >= upper and self._bought:
            # 突破上轨卖出
            pos = context.get_position(bar.symbol)
            if pos and pos.quantity > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Sell,
                    type=OrderType.Market, quantity=int(pos.quantity),
                ))
                self._bought = False

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
