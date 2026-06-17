"""模型训练器"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

from .types import ModelType, TrainConfig, ModelMetrics


_MODEL_MAP = {
    ModelType.RandomForest: RandomForestClassifier,
    ModelType.GradientBoosting: GradientBoostingClassifier,
    ModelType.LogisticRegression: LogisticRegression,
}


class ModelTrainer:
    def __init__(self, config: TrainConfig | None = None) -> None:
        self.config = config or TrainConfig()
        self._model = None

    def train(self, X: pd.DataFrame, y: pd.Series) -> ModelMetrics:
        cls = _MODEL_MAP[self.config.model_type]
        params = self.config.hyper_params or {}
        if self.config.model_type == ModelType.RandomForest:
            params.setdefault("n_estimators", 100)
            params.setdefault("max_depth", 5)
        self._model = cls(**params, random_state=self.config.random_state)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=self.config.test_size, random_state=self.config.random_state,
        )
        self._model.fit(X_train, y_train)
        y_pred = self._model.predict(X_test)

        metrics = ModelMetrics(
            accuracy=round(accuracy_score(y_test, y_pred), 4),
            precision=round(precision_score(y_test, y_pred, zero_division=0), 4),
            recall=round(recall_score(y_test, y_pred, zero_division=0), 4),
            f1=round(f1_score(y_test, y_pred, zero_division=0), 4),
        )

        try:
            y_prob = self._model.predict_proba(X_test)[:, 1]
            metrics = ModelMetrics(
                accuracy=metrics.accuracy,
                precision=metrics.precision,
                recall=metrics.recall,
                f1=metrics.f1,
                auc=round(roc_auc_score(y_test, y_prob), 4),
            )
        except (AttributeError, ValueError):
            pass

        return metrics

    def predict(self, X: pd.DataFrame) -> np.ndarray:
        if self._model is None:
            raise RuntimeError("Model not trained yet")
        return self._model.predict(X)

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if self._model is None:
            raise RuntimeError("Model not trained yet")
        return self._model.predict_proba(X)
