"""测试 sklearn 算法实现。"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from quantforge_algorithms.types import (
    ApplicationMode,
    ModelArtifact,
    TrainConfig,
)
from quantforge_algorithms.algorithms.registry import AlgorithmRegistry


def _make_classification_data(n_samples: int = 100) -> tuple[pd.DataFrame, pd.Series]:
    rng = np.random.RandomState(42)
    X = pd.DataFrame({
        "feat1": rng.randn(n_samples),
        "feat2": rng.randn(n_samples),
    })
    y = pd.Series((X["feat1"] + X["feat2"] > 0).astype(int))
    return X, y


@pytest.fixture(params=["random_forest", "gradient_boosting", "logistic_regression"])
def algorithm_name(request):
    return request.param


def test_algorithm_meta(algorithm_name):
    algo = AlgorithmRegistry.get(algorithm_name)
    meta = algo.meta
    assert meta.name == algorithm_name
    assert ApplicationMode.CROSS_SECTIONAL in meta.supported_modes
    assert ApplicationMode.TIME_SERIES in meta.supported_modes
    assert len(meta.hyper_param_defs) > 0


def test_algorithm_train_predict(algorithm_name):
    algo = AlgorithmRegistry.get(algorithm_name)
    X, y = _make_classification_data()
    config = TrainConfig(
        algorithm=algorithm_name,
        application_mode=ApplicationMode.TIME_SERIES,
        test_size=0.25,
    )
    artifact = algo.train(X, y, config)

    assert artifact.algorithm == algorithm_name
    assert artifact.feature_schema == ["feat1", "feat2"]
    assert artifact.application_mode == ApplicationMode.TIME_SERIES
    assert 0.0 <= artifact.metrics.accuracy <= 1.0

    preds = algo.predict(artifact, X)
    assert len(preds) == len(X)


def test_algorithm_save_load(algorithm_name, tmp_path):
    algo = AlgorithmRegistry.get(algorithm_name)
    X, y = _make_classification_data()
    config = TrainConfig(
        algorithm=algorithm_name,
        application_mode=ApplicationMode.CROSS_SECTIONAL,
    )
    artifact = algo.train(X, y, config)

    path = tmp_path / f"{algorithm_name}.joblib"
    algo.save(artifact, path)
    assert path.exists()

    loaded = algo.load(path)
    assert loaded.algorithm == algorithm_name
    assert loaded.feature_schema == ["feat1", "feat2"]
    assert loaded.artifact_path == str(path)


def test_registry_list_all_includes_sklearn():
    metas = AlgorithmRegistry.list_all()
    names = [m.name for m in metas]
    assert "random_forest" in names
    assert "gradient_boosting" in names
    assert "logistic_regression" in names
