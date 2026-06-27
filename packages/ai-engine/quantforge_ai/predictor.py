"""AI 预测器 — 统一入口"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from .types import TrainConfig, ModelMetrics, PredictionResult, LabelType
from .features import FeatureExtractor
from .model import ModelTrainer


class AIPredictor:
    def __init__(self, config: TrainConfig | None = None) -> None:
        self.config = config or TrainConfig()
        self._trainer = ModelTrainer(self.config)

    def train(self, df: pd.DataFrame, forward_returns: pd.Series) -> ModelMetrics:
        X = FeatureExtractor.extract_all(df)
        X = X.dropna()
        y = self._make_labels(forward_returns, X.index)
        X, y = X.align(y, join="inner", axis=0)
        return self._trainer.train(X, y)

    def save(self, path: str | Path) -> None:
        self._trainer.save(path)

    @staticmethod
    def load(path: str | Path) -> "AIPredictor":
        predictor = AIPredictor()
        predictor._trainer = ModelTrainer.load(path)
        predictor.config = predictor._trainer.config
        return predictor

    def predict(self, df: pd.DataFrame) -> PredictionResult:
        X = FeatureExtractor.extract_all(df).dropna()
        if X.empty:
            return PredictionResult()

        predictions = self._trainer.predict(X).tolist()
        try:
            probabilities = self._trainer.predict_proba(X)[:, 1].tolist()
        except (AttributeError, RuntimeError, IndexError, ValueError):
            probabilities = []
        return PredictionResult(predictions=predictions, probabilities=probabilities)

    def _make_labels(self, forward_returns: pd.Series, index: pd.Index) -> pd.Series:
        labels = forward_returns.reindex(index).dropna()
        if self.config.label_type == LabelType.ReturnBinary:
            return (labels > 0).astype(int)
        return labels
