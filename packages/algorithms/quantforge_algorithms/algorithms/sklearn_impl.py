"""sklearn 算法实现——从 ai-engine/model.py 迁移。

迁移自 ai-engine ModelTrainer._MODEL_MAP：
- RandomForest -> RandomForestAlgorithm
- GradientBoosting -> GradientBoostingAlgorithm
- LogisticRegression -> LogisticRegressionAlgorithm
"""

from __future__ import annotations

import uuid
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
from sklearn.model_selection import train_test_split

from ..types import (
    AlgorithmMeta,
    ApplicationMode,
    HyperParamDef,
    ModelArtifact,
    ModelMetrics,
    TrainConfig,
)
from .base import Algorithm


def _make_metrics(y_test, y_pred, y_prob=None) -> ModelMetrics:
    metrics = ModelMetrics(
        accuracy=round(accuracy_score(y_test, y_pred), 4),
        precision=round(precision_score(y_test, y_pred, zero_division=0), 4),
        recall=round(recall_score(y_test, y_pred, zero_division=0), 4),
        f1=round(f1_score(y_test, y_pred, zero_division=0), 4),
    )
    if y_prob is not None:
        try:
            metrics = ModelMetrics(
                accuracy=metrics.accuracy,
                precision=metrics.precision,
                recall=metrics.recall,
                f1=metrics.f1,
                auc=round(roc_auc_score(y_test, y_prob), 4),
            )
        except (ValueError, IndexError):
            pass
    return metrics


class RandomForestAlgorithm(Algorithm):
    """随机森林算法（从 ai-engine 迁移）。"""

    @property
    def meta(self) -> AlgorithmMeta:
        return AlgorithmMeta(
            name="random_forest",
            supported_modes=[ApplicationMode.CROSS_SECTIONAL, ApplicationMode.TIME_SERIES],
            hyper_param_defs=[
                HyperParamDef(key="n_estimators", label="树数量", type="int", default=100, range=(10, 500)),
                HyperParamDef(key="max_depth", label="树深", type="int", default=5, range=(1, 30)),
            ],
            description="RandomForest 分类算法",
            version="0.1.0",
        )

    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        params = dict(config.hyper_params)
        params.setdefault("n_estimators", 100)
        params.setdefault("max_depth", 5)
        model = RandomForestClassifier(**params, random_state=config.random_state)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=config.test_size, random_state=config.random_state,
        )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        y_prob = None
        try:
            y_prob = model.predict_proba(X_test)[:, 1]
        except (AttributeError, ValueError, IndexError):
            pass

        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="random_forest",
            model=model,
            config=config,
            metrics=_make_metrics(y_test, y_pred, y_prob),
            feature_schema=list(X.columns),
            application_mode=config.application_mode,
            trained_at=int(pd.Timestamp.now().timestamp()),
        )

    def predict(self, artifact: ModelArtifact, X: pd.DataFrame) -> np.ndarray:
        return artifact.model.predict(X)

    def save(self, artifact: ModelArtifact, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model": artifact.model,
            "config": artifact.config,
            "feature_schema": artifact.feature_schema,
            "application_mode": artifact.application_mode,
            "metrics": artifact.metrics,
        }, path)

    def load(self, path: Path) -> ModelArtifact:
        payload = joblib.load(path)
        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="random_forest",
            model=payload["model"],
            config=payload["config"],
            metrics=payload["metrics"],
            feature_schema=payload["feature_schema"],
            application_mode=payload["application_mode"],
            trained_at=int(pd.Timestamp.now().timestamp()),
            artifact_path=str(path),
        )


class GradientBoostingAlgorithm(Algorithm):
    """梯度提升算法（从 ai-engine 迁移）。"""

    @property
    def meta(self) -> AlgorithmMeta:
        return AlgorithmMeta(
            name="gradient_boosting",
            supported_modes=[ApplicationMode.CROSS_SECTIONAL, ApplicationMode.TIME_SERIES],
            hyper_param_defs=[
                HyperParamDef(key="n_estimators", label="树数量", type="int", default=100, range=(10, 500)),
                HyperParamDef(key="max_depth", label="树深", type="int", default=3, range=(1, 20)),
            ],
            description="GradientBoosting 分类算法",
            version="0.1.0",
        )

    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        params = dict(config.hyper_params)
        params.setdefault("n_estimators", 100)
        params.setdefault("max_depth", 3)
        model = GradientBoostingClassifier(**params, random_state=config.random_state)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=config.test_size, random_state=config.random_state,
        )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        y_prob = None
        try:
            y_prob = model.predict_proba(X_test)[:, 1]
        except (AttributeError, ValueError, IndexError):
            pass

        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="gradient_boosting",
            model=model,
            config=config,
            metrics=_make_metrics(y_test, y_pred, y_prob),
            feature_schema=list(X.columns),
            application_mode=config.application_mode,
            trained_at=int(pd.Timestamp.now().timestamp()),
        )

    def predict(self, artifact: ModelArtifact, X: pd.DataFrame) -> np.ndarray:
        return artifact.model.predict(X)

    def save(self, artifact: ModelArtifact, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model": artifact.model,
            "config": artifact.config,
            "feature_schema": artifact.feature_schema,
            "application_mode": artifact.application_mode,
            "metrics": artifact.metrics,
        }, path)

    def load(self, path: Path) -> ModelArtifact:
        payload = joblib.load(path)
        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="gradient_boosting",
            model=payload["model"],
            config=payload["config"],
            metrics=payload["metrics"],
            feature_schema=payload["feature_schema"],
            application_mode=payload["application_mode"],
            trained_at=int(pd.Timestamp.now().timestamp()),
            artifact_path=str(path),
        )


class LogisticRegressionAlgorithm(Algorithm):
    """逻辑回归算法（从 ai-engine 迁移）。"""

    @property
    def meta(self) -> AlgorithmMeta:
        return AlgorithmMeta(
            name="logistic_regression",
            supported_modes=[ApplicationMode.CROSS_SECTIONAL, ApplicationMode.TIME_SERIES],
            hyper_param_defs=[
                HyperParamDef(key="C", label="正则强度", type="float", default=1.0, range=(0.01, 100.0)),
            ],
            description="LogisticRegression 分类算法",
            version="0.1.0",
        )

    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        params = dict(config.hyper_params)
        params.setdefault("C", 1.0)
        params.setdefault("max_iter", 1000)
        model = LogisticRegression(**params, random_state=config.random_state)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=config.test_size, random_state=config.random_state,
        )
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)

        y_prob = None
        try:
            y_prob = model.predict_proba(X_test)[:, 1]
        except (AttributeError, ValueError, IndexError):
            pass

        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="logistic_regression",
            model=model,
            config=config,
            metrics=_make_metrics(y_test, y_pred, y_prob),
            feature_schema=list(X.columns),
            application_mode=config.application_mode,
            trained_at=int(pd.Timestamp.now().timestamp()),
        )

    def predict(self, artifact: ModelArtifact, X: pd.DataFrame) -> np.ndarray:
        return artifact.model.predict(X)

    def save(self, artifact: ModelArtifact, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model": artifact.model,
            "config": artifact.config,
            "feature_schema": artifact.feature_schema,
            "application_mode": artifact.application_mode,
            "metrics": artifact.metrics,
        }, path)

    def load(self, path: Path) -> ModelArtifact:
        payload = joblib.load(path)
        return ModelArtifact(
            artifact_id=str(uuid.uuid4()),
            algorithm="logistic_regression",
            model=payload["model"],
            config=payload["config"],
            metrics=payload["metrics"],
            feature_schema=payload["feature_schema"],
            application_mode=payload["application_mode"],
            trained_at=int(pd.Timestamp.now().timestamp()),
            artifact_path=str(path),
        )
