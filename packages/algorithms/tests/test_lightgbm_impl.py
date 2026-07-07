"""测试 LightGBM 算法实现（mock lightgbm 库，不依赖真实安装）。"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from quantforge_algorithms.types import (
    ApplicationMode,
    ModelArtifact,
    TrainConfig,
)
from quantforge_algorithms.algorithms.registry import AlgorithmRegistry


class _FakeLGBMModel:
    """可 pickle 的 LGBMClassifier 替身，模拟 fit/predict/predict_proba 行为。

    必须定义在模块层级以支持 pickle 序列化（save/load 测试需要）。
    predict/predict_proba 按输入行数返回正确形状的数组。
    """

    def __init__(self, **params):
        self.params = params
        self.predict_calls = 0

    def fit(self, X, y):
        pass

    def predict(self, X):
        self.predict_calls += 1
        return np.zeros(len(X), dtype=int)

    def predict_proba(self, X):
        return np.column_stack([np.ones(len(X)), np.zeros(len(X))])


@pytest.fixture
def mock_lightgbm():
    """mock lightgbm 库，使用可 pickle 的 _FakeLGBMModel 替身。

    fake_cls 保持 MagicMock 以便 assert_called_once 验证；
    模型实例由 _FakeLGBMModel 实例化，可被 joblib 序列化。
    """
    fake_cls = MagicMock(side_effect=_FakeLGBMModel)

    with patch.dict("sys.modules", {"lightgbm": MagicMock(LGBMClassifier=fake_cls)}):
        yield fake_cls


def test_lightgbm_meta():
    algo = AlgorithmRegistry.get("lightgbm")
    meta = algo.meta
    assert meta.name == "lightgbm"
    assert ApplicationMode.CROSS_SECTIONAL in meta.supported_modes
    assert ApplicationMode.TIME_SERIES in meta.supported_modes


def test_lightgbm_train(mock_lightgbm):
    fake_cls = mock_lightgbm
    algo = AlgorithmRegistry.get("lightgbm")
    X = pd.DataFrame({"feat1": [1.0, 2.0, 3.0, 4.0], "feat2": [2.0, 3.0, 4.0, 5.0]})
    y = pd.Series([0, 1, 0, 1])
    config = TrainConfig(
        algorithm="lightgbm",
        application_mode=ApplicationMode.CROSS_SECTIONAL,
        hyper_params={"max_depth": 6, "learning_rate": 0.05},
    )
    artifact = algo.train(X, y, config)

    fake_cls.assert_called_once()
    assert artifact.algorithm == "lightgbm"
    assert artifact.feature_schema == ["feat1", "feat2"]
    assert artifact.application_mode == ApplicationMode.CROSS_SECTIONAL


def test_lightgbm_predict(mock_lightgbm):
    fake_cls = mock_lightgbm
    algo = AlgorithmRegistry.get("lightgbm")
    X = pd.DataFrame({"feat1": [1.0, 2.0], "feat2": [2.0, 3.0]})
    y = pd.Series([0, 1])
    config = TrainConfig(algorithm="lightgbm", application_mode=ApplicationMode.TIME_SERIES)
    artifact = algo.train(X, y, config)

    preds = algo.predict(artifact, X)
    assert len(preds) == 2
    # predict 在 train() 和 predict() 中各调用一次，至少 2 次
    assert artifact.model.predict_calls >= 2


def test_lightgbm_save_load(mock_lightgbm, tmp_path):
    fake_cls = mock_lightgbm
    algo = AlgorithmRegistry.get("lightgbm")
    X = pd.DataFrame({"feat1": [1.0, 2.0], "feat2": [2.0, 3.0]})
    y = pd.Series([0, 1])
    config = TrainConfig(algorithm="lightgbm", application_mode=ApplicationMode.CROSS_SECTIONAL)
    artifact = algo.train(X, y, config)

    path = tmp_path / "lightgbm.joblib"
    algo.save(artifact, path)
    assert path.exists()

    loaded = algo.load(path)
    assert loaded.algorithm == "lightgbm"
    assert loaded.feature_schema == ["feat1", "feat2"]
