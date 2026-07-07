"""测试信号生成器。"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from quantforge_algorithms.types import (
    ApplicationMode,
    MLSignal,
    ModelArtifact,
    ModelMetrics,
    SignalContext,
    TrainConfig,
)
from quantforge_algorithms.signal_generators.registry import SignalGeneratorRegistry


def _make_artifact(algorithm: str = "random_forest", mode: ApplicationMode = ApplicationMode.CROSS_SECTIONAL) -> ModelArtifact:
    config = TrainConfig(algorithm=algorithm, application_mode=mode)
    return ModelArtifact(
        artifact_id="test-uuid",
        algorithm=algorithm,
        model=object(),
        config=config,
        metrics=ModelMetrics(),
        feature_schema=["feat1"],
        application_mode=mode,
        trained_at=1700000000,
    )


def test_cross_sectional_rank_generator_meta():
    gen = SignalGeneratorRegistry.get("cross_sectional_rank")
    assert gen.meta.name == "cross_sectional_rank"
    assert gen.meta.supported_mode == ApplicationMode.CROSS_SECTIONAL


def test_cross_sectional_rank_generate_top_k():
    gen = SignalGeneratorRegistry.get("cross_sectional_rank")
    artifact = _make_artifact(mode=ApplicationMode.CROSS_SECTIONAL)
    symbols = ["000001.SZ", "000002.SZ", "600519.SH", "601318.SH"]
    raw_output = np.array([0.1, 0.8, 0.5, 0.3])
    ctx = SignalContext(
        timestamp=1700000000,
        symbols=symbols,
        top_k=2,
    )
    signals = gen.generate(artifact, raw_output, ctx)
    assert len(signals) == 2
    assert all(s.side == "buy" for s in signals)
    top_symbols = {s.symbol for s in signals}
    assert "000002.SZ" in top_symbols
    assert "600519.SH" in top_symbols


def test_cross_sectional_rank_generate_all_when_top_k_none():
    gen = SignalGeneratorRegistry.get("cross_sectional_rank")
    artifact = _make_artifact(mode=ApplicationMode.CROSS_SECTIONAL)
    symbols = ["A", "B", "C"]
    raw_output = np.array([0.5, 0.3, 0.8])
    ctx = SignalContext(timestamp=1700000000, symbols=symbols)
    signals = gen.generate(artifact, raw_output, ctx)
    assert len(signals) == 3
    assert signals[0].symbol == "C"
    assert signals[0].score == 0.8


def test_time_series_classify_generator_meta():
    gen = SignalGeneratorRegistry.get("time_series_classify")
    assert gen.meta.name == "time_series_classify"
    assert gen.meta.supported_mode == ApplicationMode.TIME_SERIES


def test_time_series_classify_buy_signal():
    gen = SignalGeneratorRegistry.get("time_series_classify")
    artifact = _make_artifact(mode=ApplicationMode.TIME_SERIES)
    # 0.5 落在 hold 区间 (1-threshold=0.4, threshold=0.6) 内，验证 buy/hold/buy 三态。
    # brief 原值 0.3 在 1-threshold=0.4 之下会触发 sell，与 Step 6 实现规则冲突，故改为 0.5。
    raw_output = np.array([0.8, 0.5, 0.6])
    ctx = SignalContext(
        timestamp=1700000000,
        symbols=["000001.SZ"],
        threshold=0.6,
    )
    signals = gen.generate(artifact, raw_output, ctx)
    assert len(signals) == 3
    assert signals[0].side == "buy"
    assert signals[0].probability == 0.8
    assert signals[1].side == "hold"
    assert signals[2].side == "buy"


def test_time_series_classify_sell_signal():
    gen = SignalGeneratorRegistry.get("time_series_classify")
    artifact = _make_artifact(mode=ApplicationMode.TIME_SERIES)
    raw_output = np.array([0.2])
    ctx = SignalContext(
        timestamp=1700000000,
        symbols=["000001.SZ"],
        threshold=0.6,
    )
    signals = gen.generate(artifact, raw_output, ctx)
    assert signals[0].side == "sell"
    assert signals[0].probability == 0.2


def test_registry_list_all():
    metas = SignalGeneratorRegistry.list_all()
    names = [m.name for m in metas]
    assert "cross_sectional_rank" in names
    assert "time_series_classify" in names
