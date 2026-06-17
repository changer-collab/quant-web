"""MACD 策略 — 指数平滑异同移动平均线"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyKind, StrategyParamDef,
)


class MACDStrategy(Strategy):
    """MACD 策略：MACD 柱由负转正（金叉）买入，由正转负（死叉）卖出。

    使用 EMA(fast) 与 EMA(slow) 计算 DIF，再用 signal_period 计算 DEA，
    DIF - DEA 即为 MACD 柱。
    """

    def __init__(
        self,
        fast_period: int = 12,
        slow_period: int = 26,
        signal_period: int = 9,
    ) -> None:
        self._fast_period = fast_period
        self._slow_period = slow_period
        self._signal_period = signal_period
        self._ema_fast: float | None = None
        self._ema_slow: float | None = None
        self._dea: float | None = None
        self._prev_macd: float | None = None
        self._prices: deque[float] = deque(maxlen=slow_period + 1)
        self._bought = False

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="macd",
            description="MACD 策略：DIF 上穿 DEA 买入，下穿卖出",
            modes=[ResearchMode.Traditional],
            params=[
                StrategyParamDef(key="fast_period", label="快线周期",
                                 type=ParamType.Number, default=self._fast_period,
                                 min=2, max=100),
                StrategyParamDef(key="slow_period", label="慢线周期",
                                 type=ParamType.Number, default=self._slow_period,
                                 min=5, max=200),
                StrategyParamDef(key="signal_period", label="信号周期",
                                 type=ParamType.Number, default=self._signal_period,
                                 min=2, max=50),
            ],
            version="0.1.0",
            kind=StrategyKind.Combined,
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._ema_fast = None
        self._ema_slow = None
        self._dea = None
        self._prev_macd = None
        self._prices.clear()
        self._bought = False

    def _ema(self, prev: float | None, price: float, period: int) -> float:
        if prev is None:
            return price
        alpha = 2.0 / (period + 1)
        return alpha * price + (1 - alpha) * prev

    def on_bar(self, bar: Bar, context) -> None:
        self._prices.append(bar.close)

        # 需要至少 slow_period 根 bar 才能初始化慢线 EMA
        if len(self._prices) < self._slow_period:
            return

        self._ema_fast = self._ema(self._ema_fast, bar.close, self._fast_period)
        self._ema_slow = self._ema(self._ema_slow, bar.close, self._slow_period)

        if self._ema_fast is None or self._ema_slow is None:
            return

        dif = self._ema_fast - self._ema_slow
        self._dea = self._ema(self._dea, dif, self._signal_period)
        macd = (dif - self._dea) * 2.0

        if self._prev_macd is not None:
            # 金叉：MACD 柱由负转正
            if macd > 0 and self._prev_macd <= 0 and not self._bought:
                account = context.get_account()
                qty = int(account.cash / bar.close)
                if qty > 0:
                    context.submit_order(OrderRequest(
                        symbol=bar.symbol, side=OrderSide.Buy,
                        type=OrderType.Market, quantity=qty,
                    ))
                    self._bought = True
            # 死叉：MACD 柱由正转负
            elif macd < 0 and self._prev_macd >= 0 and self._bought:
                pos = context.get_position(bar.symbol)
                if pos and pos.quantity > 0:
                    context.submit_order(OrderRequest(
                        symbol=bar.symbol, side=OrderSide.Sell,
                        type=OrderType.Market, quantity=int(pos.quantity),
                    ))
                    self._bought = False

        self._prev_macd = macd

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
