"""截面排序信号生成器——多标的的打分 -> top_k 选股信号。"""

from __future__ import annotations

import numpy as np

from ..types import ApplicationMode, MLSignal, ModelArtifact, SignalContext, SignalGeneratorMeta
from .base import SignalGenerator


class CrossSectionalRankGenerator(SignalGenerator):
    """截面排序信号生成器。

    输入：多标的的打分数组（与 ctx.symbols 一一对应）
    输出：按打分降序取 top_k，生成 buy 信号；其余不输出（或可扩展输出 hold）
    """

    @property
    def meta(self) -> SignalGeneratorMeta:
        return SignalGeneratorMeta(
            name="cross_sectional_rank",
            supported_mode=ApplicationMode.CROSS_SECTIONAL,
            description="截面排序信号生成器——多标的的打分->top_k 选股信号",
        )

    def generate(
        self,
        artifact: ModelArtifact,
        raw_output: np.ndarray,
        ctx: SignalContext,
    ) -> list[MLSignal]:
        if len(raw_output) != len(ctx.symbols):
            raise ValueError(
                f"raw_output length {len(raw_output)} != symbols length {len(ctx.symbols)}"
            )

        ranked_indices = np.argsort(raw_output)[::-1]
        top_k = ctx.top_k if ctx.top_k is not None else len(ctx.symbols)
        selected = ranked_indices[:top_k]

        signals: list[MLSignal] = []
        for idx in selected:
            signals.append(MLSignal(
                timestamp=ctx.timestamp,
                symbol=ctx.symbols[idx],
                side="buy",
                score=float(raw_output[idx]),
                reason=f"cross_sectional_rank top_{top_k}",
            ))
        return signals
