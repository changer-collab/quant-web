"""时序分类信号生成器——单标的的概率 -> 买卖信号。"""

from __future__ import annotations

import numpy as np

from ..types import ApplicationMode, MLSignal, ModelArtifact, SignalContext, SignalGeneratorMeta
from .base import SignalGenerator


class TimeSeriesClassifyGenerator(SignalGenerator):
    """时序分类信号生成器。

    输入：单标的的按时序的概率数组（每个时点的上涨概率）
    输出：每个时点的 buy/sell/hold 信号
    - probability >= threshold -> buy
    - probability <= 1 - threshold -> sell
    - 否则 -> hold
    """

    @property
    def meta(self) -> SignalGeneratorMeta:
        return SignalGeneratorMeta(
            name="time_series_classify",
            supported_mode=ApplicationMode.TIME_SERIES,
            description="时序分类信号生成器——单标的的概率->买卖信号",
        )

    def generate(
        self,
        artifact: ModelArtifact,
        raw_output: np.ndarray,
        ctx: SignalContext,
    ) -> list[MLSignal]:
        threshold = ctx.threshold if ctx.threshold is not None else 0.5
        symbol = ctx.symbols[0] if ctx.symbols else ""

        signals: list[MLSignal] = []
        for i, prob in enumerate(raw_output):
            prob_f = float(prob)
            if prob_f >= threshold:
                side = "buy"
            elif prob_f <= 1 - threshold:
                side = "sell"
            else:
                side = "hold"

            signals.append(MLSignal(
                timestamp=ctx.timestamp + i,
                symbol=symbol,
                side=side,
                probability=prob_f,
                reason=f"time_series_classify threshold={threshold}",
            ))
        return signals
