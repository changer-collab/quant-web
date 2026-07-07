"""训练编排器——委托 AlgorithmRegistry 调用具体算法。

原 ModelTrainer 已重命名为 TrainingOrchestrator，ModelTrainer 作为别名保留兼容。
"""

from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from quantforge_algorithms import AlgorithmRegistry
from quantforge_algorithms.types import (
    ApplicationMode,
    ModelArtifact,
    ModelMetrics,
    TrainConfig,
)


class TrainingOrchestrator:
    """训练编排器——通过 AlgorithmRegistry 调度算法训练/预测/持久化。

    训练编排器不实现算法逻辑，只负责：
    - 选择算法（通过 algorithm_name 从 AlgorithmRegistry 获取）
    - 调用 Algorithm.train/predict/save/load
    - 管理 artifact 生命周期
    """

    def __init__(self) -> None:
        self._artifact: ModelArtifact | None = None

    def train(
        self,
        algorithm_name: str,
        X: pd.DataFrame,
        y: pd.Series,
        application_mode: ApplicationMode = ApplicationMode.TIME_SERIES,
        test_size: float = 0.2,
        random_state: int = 42,
        hyper_params: dict | None = None,
    ) -> ModelMetrics:
        algorithm = AlgorithmRegistry.get(algorithm_name)
        config = TrainConfig(
            algorithm=algorithm_name,
            application_mode=application_mode,
            test_size=test_size,
            random_state=random_state,
            hyper_params=hyper_params or {},
        )
        self._artifact = algorithm.train(X, y, config)
        return self._artifact.metrics

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if self._artifact is None:
            raise RuntimeError("Model not trained yet")
        algorithm_name = self._artifact.algorithm
        algorithm = AlgorithmRegistry.get(algorithm_name)
        return algorithm.predict(self._artifact, X)

    def save(self, path: str | Path) -> None:
        if self._artifact is None:
            raise RuntimeError("Model not trained yet")
        algorithm_name = self._artifact.algorithm
        algorithm = AlgorithmRegistry.get(algorithm_name)
        algorithm.save(self._artifact, Path(path))

    @staticmethod
    def load(path: str | Path) -> "TrainingOrchestrator":
        """加载 artifact——从 joblib payload 的 config.algorithm 字段分派。

        payload 由 Algorithm.save 写入，形如 {"model", "config", "feature_schema",
        "application_mode", "metrics"}，其中 config 是 TrainConfig dataclass，
        algorithm 名存在 config.algorithm。兼容旧式 dict config。
        """
        payload = joblib.load(Path(path))
        algorithm_name = payload.get("algorithm")
        if not algorithm_name:
            config = payload.get("config")
            if isinstance(config, dict):
                algorithm_name = config.get("algorithm")
            else:
                algorithm_name = getattr(config, "algorithm", None)
        algorithm_name = algorithm_name or "random_forest"
        algorithm = AlgorithmRegistry.get(algorithm_name)
        artifact = algorithm.load(Path(path))
        orchestrator = TrainingOrchestrator()
        orchestrator._artifact = artifact
        return orchestrator


# 向后兼容别名
ModelTrainer = TrainingOrchestrator
