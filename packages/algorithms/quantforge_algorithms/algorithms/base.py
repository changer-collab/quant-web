"""Algorithm 抽象基类。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

import numpy as np
import pandas as pd

from ..types import AlgorithmMeta, ModelArtifact, TrainConfig


class Algorithm(ABC):
    """算法资产层抽象基类。

    算法层只负责：训练（fit）、预测（predict）、持久化（save/load）。
    算法层不感知应用形态——同一个 LightGBM 算法可被截面排序和时序分类复用。
    """

    @property
    @abstractmethod
    def meta(self) -> AlgorithmMeta:
        """算法元数据：名称、支持的应用模式、超参定义"""

    @abstractmethod
    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        """训练模型，返回可持久化的 ModelArtifact"""

    @abstractmethod
    def predict(self, artifact: ModelArtifact, X: pd.DataFrame) -> np.ndarray:
        """使用已训练 artifact 进行预测，返回原始输出（打分/概率/embedding）"""

    @abstractmethod
    def save(self, artifact: ModelArtifact, path: Path) -> None:
        """持久化 artifact 到文件"""

    @abstractmethod
    def load(self, path: Path) -> ModelArtifact:
        """从文件加载 artifact"""
