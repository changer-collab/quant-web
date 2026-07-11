"""LightGBM 算法实现——延迟导入 lightgbm 库。

lightgbm 是可选重依赖，模块层不 import lightgbm，仅在 _import_lgbm 方法内 import。
这样本包在未安装 lightgbm 时仍可正常导入和注册 LightGBMAlgorithm，
仅在实际调用 train() 时才要求 lightgbm 已安装。
"""

from __future__ import annotations

import uuid
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

from ..types import (
    AlgorithmMeta,
    ApplicationMode,
    HyperParamDef,
    ModelArtifact,
    TrainConfig,
)
from .base import Algorithm
from .sklearn_impl import _make_metrics


class LightGBMAlgorithm(Algorithm):
    """LightGBM 算法——延迟导入 lightgbm 库。

    支持截面排序（CROSS_SECTIONAL）和时序分类（TIME_SERIES）两种应用模式。
    算法层不感知应用形态，应用模式由 TrainConfig.application_mode 携带。
    """

    @property
    def meta(self) -> AlgorithmMeta:
        return AlgorithmMeta(
            name="lightgbm",
            supported_modes=[ApplicationMode.CROSS_SECTIONAL, ApplicationMode.TIME_SERIES],
            hyper_param_defs=[
                HyperParamDef(key="max_depth", label="树深", type="int", default=-1, range=(-1, 30)),
                HyperParamDef(key="learning_rate", label="学习率", type="float", default=0.1, range=(0.001, 1.0)),
                HyperParamDef(key="n_estimators", label="树数量", type="int", default=100, range=(10, 1000)),
                HyperParamDef(key="num_leaves", label="叶子数", type="int", default=31, range=(2, 256)),
            ],
            description="LightGBM 分类算法（延迟导入）",
            version="0.1.0",
        )

    def _import_lgbm(self):
        """延迟导入 LGBMClassifier——仅在 train() 实际调用时执行。"""
        try:
            from lightgbm import LGBMClassifier
        except ImportError as e:
            raise ImportError(
                "lightgbm is required for LightGBMAlgorithm. "
                "Install with: pip install quantforge-algorithms[lightgbm]"
            ) from e
        return LGBMClassifier

    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        LGBMClassifier = self._import_lgbm()
        params = dict(config.hyper_params)
        params.setdefault("max_depth", -1)
        params.setdefault("learning_rate", 0.1)
        params.setdefault("n_estimators", 100)
        params.setdefault("num_leaves", 31)
        model = LGBMClassifier(**params, random_state=config.random_state, verbose=-1)

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
            algorithm="lightgbm",
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
            algorithm="lightgbm",
            model=payload["model"],
            config=payload["config"],
            metrics=payload["metrics"],
            feature_schema=payload["feature_schema"],
            application_mode=payload["application_mode"],
            trained_at=int(pd.Timestamp.now().timestamp()),
            artifact_path=str(path),
        )
