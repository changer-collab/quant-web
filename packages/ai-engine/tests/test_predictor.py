"""测试 AIPredictor 废弃兼容性。"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import pytest


def test_ai_predictor_import_emits_deprecation_warning():
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        from quantforge_ai.predictor import AIPredictor
        assert len(w) >= 1
        assert any(issubclass(wi.category, DeprecationWarning) for wi in w)


def test_ai_predictor_replaced_by_training_orchestrator():
    """AIPredictor 的训练能力迁移到 TrainingOrchestrator。"""
    from quantforge_ai.model import TrainingOrchestrator
    rng = np.random.RandomState(0)
    df = pd.DataFrame({
        "close": rng.randn(100).cumsum() + 100,
    })
    orchestrator = TrainingOrchestrator()
    X = df[["close"]]
    y = (df["close"].pct_change().shift(-1) > 0).astype(int).dropna()
    X = X.loc[y.index]
    metrics = orchestrator.train("random_forest", X, y)
    assert metrics is not None


def test_ai_predictor_train_uses_config_algorithm_not_hardcoded():
    """AIPredictor.train() 应使用 self.config.algorithm，不应硬编码 random_forest。

    回归保护：旧实现硬编码 "random_forest"，导致 legacy payload 传入
    modelType=gradientBoosting/logisticRegression 时静默训练错误算法。
    """
    from unittest.mock import MagicMock

    from quantforge_algorithms.types import ApplicationMode, TrainConfig

    config = TrainConfig(
        algorithm="logistic_regression",
        application_mode=ApplicationMode.TIME_SERIES,
        test_size=0.3,
        random_state=7,
        hyper_params={"C": 1.0},
    )
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        from quantforge_ai.predictor import AIPredictor
    predictor = AIPredictor(config=config)
    mock_orchestrator = MagicMock()
    predictor._orchestrator = mock_orchestrator

    rng = np.random.RandomState(0)
    n = 200
    df = pd.DataFrame({
        "close": rng.randn(n).cumsum() + 100,
        "volume": rng.randint(1000, 10000, size=n).astype(float),
    })
    forward_returns = df["close"].pct_change().shift(-1)

    predictor.train(df, forward_returns)

    mock_orchestrator.train.assert_called_once()
    call_args = mock_orchestrator.train.call_args
    # 第一个位置参数应为 config.algorithm，而非硬编码 random_forest
    assert call_args.args[0] == "logistic_regression"
    # 完整尊重 config：application_mode / test_size / random_state / hyper_params
    assert call_args.kwargs["application_mode"] == ApplicationMode.TIME_SERIES
    assert call_args.kwargs["test_size"] == 0.3
    assert call_args.kwargs["random_state"] == 7
    assert call_args.kwargs["hyper_params"] == {"C": 1.0}
