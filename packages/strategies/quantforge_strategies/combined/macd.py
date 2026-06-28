"""MACD 策略 — 指数平滑异同移动平均线"""

from __future__ import annotations

from collections import deque

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, OrderSide, OrderType, OrderRequest, ParamType, ResearchMode,
    StrategyKind, StrategyParamDef, StrategyCategory, StrategySubcategory,
)
from ..indicators import macd, last_valid


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
        self._prices: deque[float] = deque(maxlen=slow_period + signal_period + 5)
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

        # 需要足够的数据来计算 MACD
        if len(self._prices) < self._slow_period + self._signal_period:
            return

        prices = list(self._prices)
        dif, dea, hist = macd(
            prices, self._fast_period, self._slow_period, self._signal_period
        )
        macd_value = last_valid(hist)
        if macd_value is None:
            return

        # 检测柱状图由负转正/由正转负
        # 取最后两个有效值
        valid_hist = [h for h in hist if h == h]  # filter NaN
        if len(valid_hist) < 2:
            return
        prev_macd = valid_hist[-2]
        cur_macd = valid_hist[-1]

        # 金叉：MACD 柱由负转正
        if cur_macd > 0 and prev_macd <= 0 and not self._bought:
            account = context.get_account()
            qty = int(account.cash / bar.close)
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                    reason=f"MACD金叉：柱状图{prev_macd:.4f}→{cur_macd:.4f}",
                ))
                self._bought = True
        # 死叉：MACD 柱由正转负
        elif cur_macd < 0 and prev_macd >= 0 and self._bought:
            pos = context.get_position(bar.symbol)
            if pos and pos.quantity > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Sell,
                    type=OrderType.Market, quantity=int(pos.quantity),
                    reason=f"MACD死叉：柱状图{prev_macd:.4f}→{cur_macd:.4f}",
                ))
                self._bought = False

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)
