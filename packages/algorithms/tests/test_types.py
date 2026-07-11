"""测试算法层核心类型。"""

from __future__ import annotations

import pytest

from quantforge_algorithms.types import (
    ApplicationMode,
    AlgorithmMeta,
    HyperParamDef,
    TrainConfig,
    ModelMetrics,
    LabelType,
    ModelArtifact,
    MLSignal,
    SignalContext,
    SignalGeneratorMeta,
)


def test_application_mode_values():
    assert ApplicationMode.CROSS_SECTIONAL == "cross_sectional"
    assert ApplicationMode.TIME_SERIES == "time_series"
    assert ApplicationMode.GRAPH_EMBEDDING == "graph_embedding"


def test_hyper_param_def_creation():
    param = HyperParamDef(
        key="max_depth",
        label="树深",
        type="int",
        default=6,
        range=(1, 20),
    )
    assert param.key == "max_depth"
    assert param.range == (1, 20)


def test_algorithm_meta_creation():
    meta = AlgorithmMeta(
        name="lightgbm",
        supported_modes=[ApplicationMode.CROSS_SECTIONAL, ApplicationMode.TIME_SERIES],
        hyper_param_defs=[],
        description="LightGBM 算法",
        version="0.1.0",
    )
    assert meta.name == "lightgbm"
    assert ApplicationMode.CROSS_SECTIONAL in meta.supported_modes


def test_train_config_with_application_mode():
    config = TrainConfig(
        algorithm="lightgbm",
        application_mode=ApplicationMode.CROSS_SECTIONAL,
    )
    assert config.algorithm == "lightgbm"
    assert config.application_mode == ApplicationMode.CROSS_SECTIONAL
    assert config.test_size == 0.2
    assert config.random_state == 42


def test_train_config_default_label_type():
    config = TrainConfig(algorithm="random_forest", application_mode=ApplicationMode.TIME_SERIES)
    assert config.label_type == LabelType.RETURN_BINARY


def test_model_metrics_defaults():
    metrics = ModelMetrics()
    assert metrics.accuracy == 0.0
    assert metrics.auc == 0.0


def test_model_artifact_creation():
    config = TrainConfig(algorithm="lightgbm", application_mode=ApplicationMode.CROSS_SECTIONAL)
    artifact = ModelArtifact(
        artifact_id="test-uuid",
        algorithm="lightgbm",
        model=object(),
        config=config,
        metrics=ModelMetrics(),
        feature_schema=["feat1", "feat2"],
        application_mode=ApplicationMode.CROSS_SECTIONAL,
        trained_at=1700000000,
    )
    assert artifact.artifact_id == "test-uuid"
    assert artifact.artifact_path is None
    assert artifact.feature_schema == ["feat1", "feat2"]


def test_ml_signal_creation():
    signal = MLSignal(
        timestamp=1700000000,
        symbol="000001.SZ",
        side="buy",
        score=0.85,
    )
    assert signal.side == "buy"
    assert signal.score == 0.85
    assert signal.probability is None


def test_signal_context_creation():
    ctx = SignalContext(
        timestamp=1700000000,
        symbols=["000001.SZ", "600519.SH"],
        top_k=5,
    )
    assert ctx.top_k == 5
    assert ctx.threshold is None


def test_signal_generator_meta_creation():
    meta = SignalGeneratorMeta(
        name="cross_sectional_rank",
        supported_mode=ApplicationMode.CROSS_SECTIONAL,
        description="截面排序信号生成器",
    )
    assert meta.name == "cross_sectional_rank"
