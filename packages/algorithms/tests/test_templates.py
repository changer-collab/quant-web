"""测试预定义模板。"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from quantforge_algorithms.types import (
    ApplicationMode,
    SignalContext,
    TrainConfig,
)
from quantforge_algorithms.templates.registry import TemplateRegistry


# --------------------------------------------------------------------------- #
# brief 指定的 6 个测试：注册表与元数据
# --------------------------------------------------------------------------- #


def test_template_registry_list_all():
    templates = TemplateRegistry.list_all()
    template_ids = [t.template_id for t in templates]
    assert "lightgbm_stock_selection" in template_ids
    assert "lightgbm_timing" in template_ids
    assert "random_forest_stock_selection" in template_ids
    assert "random_forest_timing" in template_ids


def test_template_meta_lightgbm_stock_selection():
    template = TemplateRegistry.get("lightgbm_stock_selection")
    assert template.application_mode == ApplicationMode.CROSS_SECTIONAL
    assert template.algorithm == "lightgbm"
    assert template.signal_generator == "cross_sectional_rank"
    assert template.is_combo is False
    assert template.category_hint.value == "factor_based"
    assert template.subcategory_hint.value == "ml_nonlinear_factor"


def test_template_meta_lightgbm_timing():
    template = TemplateRegistry.get("lightgbm_timing")
    assert template.application_mode == ApplicationMode.TIME_SERIES
    assert template.algorithm == "lightgbm"
    assert template.signal_generator == "time_series_classify"
    assert template.is_combo is False
    assert template.category_hint.value == "non_factor"
    assert template.subcategory_hint.value == "e2e_ai_timeseries"


def test_template_meta_random_forest_stock_selection():
    template = TemplateRegistry.get("random_forest_stock_selection")
    assert template.algorithm == "random_forest"
    assert template.application_mode == ApplicationMode.CROSS_SECTIONAL


def test_template_meta_random_forest_timing():
    template = TemplateRegistry.get("random_forest_timing")
    assert template.algorithm == "random_forest"
    assert template.application_mode == ApplicationMode.TIME_SERIES


def test_template_get_not_found():
    with pytest.raises(KeyError, match="Template 'nonexistent' not registered"):
        TemplateRegistry.get("nonexistent")


# --------------------------------------------------------------------------- #
# 端到端测试：random_forest 模板 train -> artifact -> signal 全链路
# （lightgbm 算法在 Task 6 尚未实现，故仅测 random_forest 模板）
# --------------------------------------------------------------------------- #


def test_end_to_end_random_forest_stock_selection():
    """random_forest_stock_selection 模板端到端：算法训练 -> 产物 -> 截面排序信号。"""
    from quantforge_algorithms.algorithms.registry import AlgorithmRegistry
    from quantforge_algorithms.signal_generators.registry import (
        SignalGeneratorRegistry,
    )

    template = TemplateRegistry.get("random_forest_stock_selection")

    # 可分数据：20 个标的，前 10 个正样本（高特征），后 10 个负样本（低特征）
    rng = np.random.RandomState(42)
    X_pos = rng.normal(loc=2.0, scale=0.3, size=(10, 5))
    X_neg = rng.normal(loc=0.0, scale=0.3, size=(10, 5))
    X = pd.DataFrame(
        np.vstack([X_pos, X_neg]),
        columns=[f"f{i}" for i in range(5)],
    )
    y = pd.Series([1] * 10 + [0] * 10)
    symbols = [f"S{i:03d}" for i in range(20)]

    # 用模板元数据构建 TrainConfig
    config = TrainConfig(
        algorithm=template.algorithm,
        application_mode=template.application_mode,
        hyper_params=dict(template.hyper_param_overrides),
    )

    # 训练
    algo = AlgorithmRegistry.get(template.algorithm)
    artifact = algo.train(X, y, config)
    assert artifact.algorithm == "random_forest"
    assert artifact.application_mode == ApplicationMode.CROSS_SECTIONAL
    assert artifact.feature_schema == [f"f{i}" for i in range(5)]

    # 预测
    raw_output = algo.predict(artifact, X)
    assert len(raw_output) == 20

    # 信号生成
    gen = SignalGeneratorRegistry.get(template.signal_generator)
    ctx = SignalContext(timestamp=1700000000, symbols=symbols, top_k=5)
    signals = gen.generate(artifact, raw_output, ctx)
    assert len(signals) == 5
    assert all(s.side == "buy" for s in signals)
    assert {s.symbol for s in signals}.issubset(set(symbols))
    # 可分数据下，正样本（前 10 个标的）应被排到 top_k
    pos_symbols = set(symbols[:10])
    assert all(s.symbol in pos_symbols for s in signals)


def test_end_to_end_random_forest_timing():
    """random_forest_timing 模板端到端：算法训练 -> 产物 -> 时序分类信号。"""
    from quantforge_algorithms.algorithms.registry import AlgorithmRegistry
    from quantforge_algorithms.signal_generators.registry import (
        SignalGeneratorRegistry,
    )

    template = TemplateRegistry.get("random_forest_timing")

    # 单标的时序数据：30 个时点，前 15 个负样本，后 15 个正样本
    rng = np.random.RandomState(42)
    X_neg = rng.normal(loc=0.0, scale=0.3, size=(15, 3))
    X_pos = rng.normal(loc=2.0, scale=0.3, size=(15, 3))
    X = pd.DataFrame(
        np.vstack([X_neg, X_pos]),
        columns=[f"f{i}" for i in range(3)],
    )
    y = pd.Series([0] * 15 + [1] * 15)

    config = TrainConfig(
        algorithm=template.algorithm,
        application_mode=template.application_mode,
        hyper_params=dict(template.hyper_param_overrides),
    )

    algo = AlgorithmRegistry.get(template.algorithm)
    artifact = algo.train(X, y, config)
    assert artifact.algorithm == "random_forest"
    assert artifact.application_mode == ApplicationMode.TIME_SERIES

    raw_output = algo.predict(artifact, X)
    assert len(raw_output) == 30

    gen = SignalGeneratorRegistry.get(template.signal_generator)
    ctx = SignalContext(timestamp=1700000000, symbols=["000001.SZ"], threshold=0.6)
    signals = gen.generate(artifact, raw_output, ctx)
    assert len(signals) == 30
    sides = {s.side for s in signals}
    # 可分数据下，label=1 -> buy，label=0 -> sell，两种都应出现
    assert "buy" in sides
    assert "sell" in sides
    # 所有信号都应附带 probability 字段
    assert all(s.probability is not None for s in signals)
