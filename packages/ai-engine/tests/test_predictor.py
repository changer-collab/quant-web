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
