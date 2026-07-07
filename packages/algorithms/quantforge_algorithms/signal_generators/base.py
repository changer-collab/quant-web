"""SignalGenerator 抽象基类。"""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from ..types import MLSignal, ModelArtifact, SignalContext, SignalGeneratorMeta


class SignalGenerator(ABC):
    """信号生成器——把算法原始输出转换为策略可消费的统一信号。

    信号生成器决定应用形态：
    - CrossSectionalRankGenerator：多标的的打分 -> 选股信号（top_k 标的 + 权重）
    - TimeSeriesClassifyGenerator：单标的的概率 -> 买卖信号（threshold 触发）
    - GraphEmbeddingGenerator：GNN embedding -> 非线性因子（输出因子值供下游消费）
    """

    @property
    @abstractmethod
    def meta(self) -> SignalGeneratorMeta:
        """信号生成器元数据"""

    @abstractmethod
    def generate(
        self,
        artifact: ModelArtifact,
        raw_output: np.ndarray,
        ctx: SignalContext,
    ) -> list[MLSignal]:
        """把算法原始输出转换为统一信号"""
