"""测试 Algorithm ABC 和 AlgorithmRegistry。"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from quantforge_algorithms.types import (
    AlgorithmMeta,
    ApplicationMode,
    HyperParamDef,
    ModelArtifact,
    ModelMetrics,
    TrainConfig,
)
from quantforge_algorithms.algorithms.base import Algorithm
from quantforge_algorithms.algorithms.registry import AlgorithmRegistry


class _DummyAlgorithm(Algorithm):
    """测试用 Algorithm 实现。"""

    @property
    def meta(self) -> AlgorithmMeta:
        return AlgorithmMeta(
            name="dummy",
            supported_modes=[ApplicationMode.TIME_SERIES],
            hyper_param_defs=[],
            description="测试算法",
            version="0.1.0",
        )

    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        model = {"mean": float(y.mean())}
        metrics = ModelMetrics(accuracy=1.0)
        return ModelArtifact(
            artifact_id="dummy-uuid",
            algorithm="dummy",
            model=model,
            config=config,
            metrics=metrics,
            feature_schema=list(X.columns),
            application_mode=config.application_mode,
            trained_at=1700000000,
        )

    def predict(self, artifact: ModelArtifact, X: pd.DataFrame) -> np.ndarray:
        return np.full(len(X), artifact.model["mean"])

    def save(self, artifact: ModelArtifact, path: Path) -> None:
        import joblib
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"model": artifact.model, "config": artifact.config}, path)

    def load(self, path: Path) -> ModelArtifact:
        import joblib
        payload = joblib.load(path)
        return ModelArtifact(
            artifact_id="dummy-loaded",
            algorithm="dummy",
            model=payload["model"],
            config=payload["config"],
            metrics=ModelMetrics(),
            feature_schema=[],
            application_mode=payload["config"].application_mode,
            trained_at=1700000000,
            artifact_path=str(path),
        )


def test_algorithm_is_abstract():
    with pytest.raises(TypeError):
        Algorithm()


def test_dummy_algorithm_train_predict():
    algo = _DummyAlgorithm()
    X = pd.DataFrame({"feat": [1.0, 2.0, 3.0, 4.0]})
    y = pd.Series([0, 1, 0, 1])
    config = TrainConfig(algorithm="dummy", application_mode=ApplicationMode.TIME_SERIES)
    artifact = algo.train(X, y, config)
    assert artifact.algorithm == "dummy"
    assert artifact.application_mode == ApplicationMode.TIME_SERIES
    assert artifact.feature_schema == ["feat"]

    preds = algo.predict(artifact, X)
    assert len(preds) == 4


def test_dummy_algorithm_save_load(tmp_path):
    algo = _DummyAlgorithm()
    X = pd.DataFrame({"feat": [1.0, 2.0]})
    y = pd.Series([0, 1])
    config = TrainConfig(algorithm="dummy", application_mode=ApplicationMode.TIME_SERIES)
    artifact = algo.train(X, y, config)

    path = tmp_path / "dummy.joblib"
    algo.save(artifact, path)
    assert path.exists()

    loaded = algo.load(path)
    assert loaded.model["mean"] == artifact.model["mean"]
    assert loaded.artifact_path == str(path)


def test_registry_register_and_get():
    AlgorithmRegistry.register(_DummyAlgorithm)
    algo = AlgorithmRegistry.get("dummy")
    assert algo.meta.name == "dummy"


def test_registry_get_not_found():
    with pytest.raises(KeyError, match="Algorithm 'nonexistent' not registered"):
        AlgorithmRegistry.get("nonexistent")


def test_registry_list_all_includes_dummy():
    AlgorithmRegistry.register(_DummyAlgorithm)
    metas = AlgorithmRegistry.list_all()
    names = [m.name for m in metas]
    assert "dummy" in names
