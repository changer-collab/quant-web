"""测试 GNN 算法骨架。"""

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


def test_gnn_meta():
    algo = AlgorithmRegistry.get("gnn")
    meta = algo.meta
    assert meta.name == "gnn"
    assert ApplicationMode.GRAPH_EMBEDDING in meta.supported_modes


def test_gnn_train_returns_artifact():
    algo = AlgorithmRegistry.get("gnn")
    X = pd.DataFrame({"feat1": [1.0, 2.0, 3.0], "feat2": [2.0, 3.0, 4.0]})
    y = pd.Series([0, 1, 0])
    config = TrainConfig(algorithm="gnn", application_mode=ApplicationMode.GRAPH_EMBEDDING)
    artifact = algo.train(X, y, config)

    assert artifact.algorithm == "gnn"
    assert artifact.application_mode == ApplicationMode.GRAPH_EMBEDDING
    assert artifact.feature_schema == ["feat1", "feat2"]


def test_gnn_predict_returns_embedding():
    algo = AlgorithmRegistry.get("gnn")
    X = pd.DataFrame({"feat1": [1.0, 2.0, 3.0], "feat2": [2.0, 3.0, 4.0]})
    y = pd.Series([0, 1, 0])
    config = TrainConfig(algorithm="gnn", application_mode=ApplicationMode.GRAPH_EMBEDDING)
    artifact = algo.train(X, y, config)

    embedding = algo.predict(artifact, X)
    assert embedding.shape[0] == 3
    assert embedding.shape[1] >= 1


def test_gnn_save_load(tmp_path):
    algo = AlgorithmRegistry.get("gnn")
    X = pd.DataFrame({"feat1": [1.0, 2.0], "feat2": [2.0, 3.0]})
    y = pd.Series([0, 1])
    config = TrainConfig(algorithm="gnn", application_mode=ApplicationMode.GRAPH_EMBEDDING)
    artifact = algo.train(X, y, config)

    path = tmp_path / "gnn.joblib"
    algo.save(artifact, path)
    assert path.exists()

    loaded = algo.load(path)
    assert loaded.algorithm == "gnn"
