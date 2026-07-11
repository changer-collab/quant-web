"""测试 TrainingOrchestrator（原 ModelTrainer）。"""

from __future__ import annotations

import warnings

import numpy as np
import pandas as pd
import pytest

from quantforge_ai.model import TrainingOrchestrator
from quantforge_ai.types import TrainConfig, ModelMetrics


def _make_data(n=80):
    rng = np.random.RandomState(0)
    X = pd.DataFrame({"a": rng.randn(n), "b": rng.randn(n)})
    y = pd.Series((X["a"] + X["b"] > 0).astype(int))
    return X, y


def test_training_orchestrator_train_returns_metrics():
    orchestrator = TrainingOrchestrator()
    X, y = _make_data()
    metrics = orchestrator.train("random_forest", X, y)
    assert isinstance(metrics, ModelMetrics)
    assert 0.0 <= metrics.accuracy <= 1.0


def test_training_orchestrator_predict():
    orchestrator = TrainingOrchestrator()
    X, y = _make_data()
    orchestrator.train("random_forest", X, y)
    preds = orchestrator.predict(X)
    assert len(preds) == len(X)


def test_training_orchestrator_save_load(tmp_path):
    orchestrator = TrainingOrchestrator()
    X, y = _make_data()
    orchestrator.train("random_forest", X, y)
    path = tmp_path / "model.joblib"
    orchestrator.save(path)
    assert path.exists()

    loaded = TrainingOrchestrator.load(path)
    preds = loaded.predict(X)
    assert len(preds) == len(X)


def test_model_trainer_backward_compatible():
    """ModelTrainer 作为 TrainingOrchestrator 别名，向后兼容。"""
    from quantforge_ai.model import ModelTrainer
    assert ModelTrainer is TrainingOrchestrator


def test_model_type_deprecated_reexport():
    """ModelType 废弃但仍 re-export 兼容。"""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        from quantforge_ai.types import ModelType
        assert ModelType.RandomForest is not None
