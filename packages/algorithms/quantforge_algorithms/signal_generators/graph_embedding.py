"""图嵌入信号生成器——GNN embedding → 非线性因子值。"""

from __future__ import annotations

import numpy as np

from ..types import ApplicationMode, MLSignal, ModelArtifact, SignalContext, SignalGeneratorMeta
from .base import SignalGenerator


class GraphEmbeddingGenerator(SignalGenerator):
    """图嵌入信号生成器。

    输入：GNN 输出的 embedding 矩阵（n_samples × embedding_dim）
    输出：每个样本的因子值（embedding 的 L2 范数作为因子值的占位实现）
    """

    @property
    def meta(self) -> SignalGeneratorMeta:
        return SignalGeneratorMeta(
            name="graph_embedding",
            supported_mode=ApplicationMode.GRAPH_EMBEDDING,
            description="图嵌入信号生成器——GNN embedding→因子值",
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

        factor_values = np.linalg.norm(raw_output, axis=1) if raw_output.ndim > 1 else raw_output

        signals: list[MLSignal] = []
        for i, symbol in enumerate(ctx.symbols):
            signals.append(MLSignal(
                timestamp=ctx.timestamp,
                symbol=symbol,
                side="hold",
                score=float(factor_values[i]),
                reason="graph_embedding factor value",
            ))
        return signals
