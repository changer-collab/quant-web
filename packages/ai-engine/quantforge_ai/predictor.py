"""AIPredictor 已废弃——训练能力迁移到 TrainingOrchestrator，信号生成迁移到 algorithms.signal_generators。

保留 re-export 兼容旧代码，导入时发 DeprecationWarning。
"""

from __future__ import annotations

import warnings

from quantforge_algorithms.types import ApplicationMode

from .model import TrainingOrchestrator

warnings.warn(
    "AIPredictor is deprecated. Use TrainingOrchestrator for training and "
    "quantforge_algorithms.signal_generators for signal generation.",
    DeprecationWarning,
    stacklevel=2,
)


class AIPredictor:
    """已废弃——保留兼容性，内部委托 TrainingOrchestrator。"""

    def __init__(self, config=None) -> None:
        from .types import TrainConfig

        self.config = config or TrainConfig(
            algorithm="random_forest",
            application_mode=ApplicationMode.TIME_SERIES,
        )
        self._orchestrator = TrainingOrchestrator()

    def train(self, df, forward_returns):
        from .features import FeatureExtractor

        X = FeatureExtractor.extract_all(df).dropna()
        y = (forward_returns.reindex(X.index).dropna() > 0).astype(int)
        X, y = X.align(y, join="inner", axis=0)
        return self._orchestrator.train(
            "random_forest",
            X,
            y,
            application_mode=self.config.application_mode,
        )

    def save(self, path):
        self._orchestrator.save(path)

    @staticmethod
    def load(path):
        predictor = AIPredictor()
        predictor._orchestrator = TrainingOrchestrator.load(path)
        return predictor

    def predict(self, df):
        from .features import FeatureExtractor
        from .types import PredictionResult

        X = FeatureExtractor.extract_all(df).dropna()
        if X.empty:
            return PredictionResult()
        preds = self._orchestrator.predict(X).tolist()
        return PredictionResult(predictions=preds, probabilities=[])
