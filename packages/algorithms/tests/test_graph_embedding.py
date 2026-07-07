"""测试 GraphEmbeddingGenerator 信号生成器。

图嵌入生成器把 GNN 输出的 embedding 矩阵转换为因子值（L2 范数），
输出 side="hold" 的 MLSignal——因子值供下游消费，不直接产生买卖信号。
"""

from __future__ import annotations

import numpy as np
import pytest

from quantforge_algorithms.types import (
    ApplicationMode,
    ModelArtifact,
    ModelMetrics,
    SignalContext,
    TrainConfig,
)
from quantforge_algorithms.signal_generators.registry import SignalGeneratorRegistry


def _make_artifact() -> ModelArtifact:
    """构造最小 ModelArtifact。

    graph_embedding 生成器不读取 artifact.model，只需一个合法 artifact 透传。
    """
    config = TrainConfig(
        algorithm="gnn",
        application_mode=ApplicationMode.GRAPH_EMBEDDING,
    )
    return ModelArtifact(
        artifact_id="test-uuid",
        algorithm="gnn",
        model=object(),
        config=config,
        metrics=ModelMetrics(),
        feature_schema=["feat1", "feat2"],
        application_mode=ApplicationMode.GRAPH_EMBEDDING,
        trained_at=1700000000,
    )


def test_graph_embedding_generator_meta():
    gen = SignalGeneratorRegistry.get("graph_embedding")
    assert gen.meta.name == "graph_embedding"
    assert gen.meta.supported_mode == ApplicationMode.GRAPH_EMBEDDING


def test_graph_embedding_length_mismatch_raises():
    gen = SignalGeneratorRegistry.get("graph_embedding")
    artifact = _make_artifact()
    symbols = ["000001.SZ", "000002.SZ"]
    # raw_output 3 行 != symbols 2 个
    raw_output = np.array([[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]])
    ctx = SignalContext(timestamp=1700000000, symbols=symbols)
    with pytest.raises(ValueError, match="raw_output length 3 != symbols length 2"):
        gen.generate(artifact, raw_output, ctx)


def test_graph_embedding_l2_norm_to_score():
    gen = SignalGeneratorRegistry.get("graph_embedding")
    artifact = _make_artifact()
    symbols = ["000001.SZ", "000002.SZ"]
    # L2 范数：sqrt(3^2+4^2)=5.0，sqrt(1^2+0^2)=1.0
    raw_output = np.array([[3.0, 4.0], [1.0, 0.0]])
    ctx = SignalContext(timestamp=1700000000, symbols=symbols)
    signals = gen.generate(artifact, raw_output, ctx)
    assert signals[0].score == pytest.approx(5.0)
    assert signals[1].score == pytest.approx(1.0)


def test_graph_embedding_side_is_hold():
    gen = SignalGeneratorRegistry.get("graph_embedding")
    artifact = _make_artifact()
    symbols = ["000001.SZ", "000002.SZ", "600519.SH"]
    raw_output = np.array([[3.0, 4.0], [1.0, 0.0], [0.0, 0.0]])
    ctx = SignalContext(timestamp=1700000000, symbols=symbols)
    signals = gen.generate(artifact, raw_output, ctx)
    assert all(s.side == "hold" for s in signals)


def test_graph_embedding_signal_count_matches_symbols():
    gen = SignalGeneratorRegistry.get("graph_embedding")
    artifact = _make_artifact()
    symbols = ["000001.SZ", "000002.SZ", "600519.SH", "601318.SH"]
    raw_output = np.array([[1.0, 0.0], [0.0, 1.0], [1.0, 1.0], [2.0, 2.0]])
    ctx = SignalContext(timestamp=1700000000, symbols=symbols)
    signals = gen.generate(artifact, raw_output, ctx)
    assert len(signals) == len(symbols)
    # 信号顺序与 symbols 顺序一一对应
    assert [s.symbol for s in signals] == symbols
    # timestamp 从 ctx 透传
    assert all(s.timestamp == 1700000000 for s in signals)
