"""KDJ 策略 — 随机指标"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyKind, StrategyParamDef,
)


class KDJStrategy(Strategy):
    """KDJ 策略：K 线上穿 D 线（金叉）且处于超卖区买入，下穿（死叉）且处于超买区卖出。

    使用 RSV（未成熟随机值）计算 K、D、J：
      RSV = (close - lowest_low) / (highest_high - lowest_low) * 100
      K = 2/3 * prev_K + 1/3 * RSV
      D = 2/3 * prev_D + 1/3 * K
      J = 3 * K - 2 * D
    """

    def __init__(
        self,
        period: int = 9,
        oversold: float = 20.0,
        overbought: float = 80.0,
    ) -> None:
        self._period = period
        self._oversold = oversold
        self._overbought = overbought
        self._highs: deque[float] = deque(maxlen=period)
        self._lows: deque[float] = deque(maxlen=period)
        self._k: float = 50.0
        self._d: float = 50.0
        self._prev_k: float | None = None
        self._prev_d: float | None = None
        self._bought = False

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="kdj",
            description="KDJ 策略：K 线在超卖区上穿 D 线买入，在超买区下穿卖出",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="period", label="KDJ 周期",
                                 type=ParamType.Number, default=self._period,
                                 min=2, max=100),
                StrategyParamDef(key="oversold", label="超卖阈值",
                                 type=ParamType.Number, default=self._oversold,
                                 min=5, max=40),
                StrategyParamDef(key="overbought", label="超买阈值",
                                 type=ParamType.Number, default=self._overbought,
                                 min=60, max=95),
            ],
            version="0.1.0",
            kind=StrategyKind.Combined,
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._highs.clear()
        self._lows.clear()
        self._k = 50.0
        self._d = 50.0
        self._prev_k = None
        self._prev_d = None
        self._bought = False

    def on_bar(self, bar: Bar, context) -> None:
        self._highs.append(bar.high)
        self._lows.append(bar.low)

        if len(self._highs) < self._period:
            return

        highest = max(self._highs)
        lowest = min(self._lows)
        if highest == lowest:
            rsv = 50.0
        else:
            rsv = (bar.close - lowest) / (highest - lowest) * 100.0

        # 递推 K、D
        self._k = (2.0 / 3.0) * self._k + (1.0 / 3.0) * rsv
        self._d = (2.0 / 3.0) * self._d + (1.0 / 3.0) * self._k

        if self._prev_k is not None and self._prev_d is not None:
            # 金叉：K 上穿 D 且 K 处于超卖区
            golden_cross = self._prev_k <= self._prev_d and self._k > self._d
            # 死叉：K 下穿 D 且 K 处于超买区
            death_cross = self._prev_k >= self._prev_d and self._k < self._d

            if golden_cross and self._k < self._oversold and not self._bought:
                account = context.get_account()
                qty = int(account.cash / bar.close)
                if qty > 0:
                    context.submit_order(OrderRequest(
                        symbol=bar.symbol, side=OrderSide.Buy,
                        type=OrderType.Market, quantity=qty,
                    ))
                    self._bought = True
            elif death_cross and self._k > self._overbought and self._bought:
                pos = context.get_position(bar.symbol)
                if pos and pos.quantity > 0:
                    context.submit_order(OrderRequest(
                        symbol=bar.symbol, side=OrderSide.Sell,
                        type=OrderType.Market, quantity=int(pos.quantity),
                    ))
                    self._bought = False

        self._prev_k = self._k
        self._prev_d = self._d

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
