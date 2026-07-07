"""测试 GNN+LightGBM 组合模板。"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from quantforge_algorithms.types import (
    ApplicationMode,
    SignalContext,
    TrainConfig,
)
from quantforge_algorithms.templates.registry import TemplateRegistry
from quantforge_algorithms.templates.base import ComboContext


class _FakeLGBMModel:
    """可 pickle 的 LGBMClassifier 替身，模拟 fit/predict/predict_proba 行为。

    必须定义在模块层级以支持 pickle 序列化（save/load 测试需要）。
    predict/predict_proba 按输入行数返回正确形状的数组。
    """

    def __init__(self, **params):
        self.params = params
        self.predict_calls = 0

    def fit(self, X, y):
        pass

    def predict(self, X):
        self.predict_calls += 1
        return np.zeros(len(X), dtype=int)

    def predict_proba(self, X):
        return np.column_stack([np.ones(len(X)), np.zeros(len(X))])


@pytest.fixture
def mock_lightgbm():
    """mock lightgbm 库，使用可 pickle 的 _FakeLGBMModel 替身。

    lightgbm 未安装，组合模板的 LightGBM 阶段必须 mock 才能 run 通。
    fake_cls 保持 MagicMock 以便验证调用；模型实例由 _FakeLGBMModel 实例化，可被 joblib 序列化。
    """
    fake_cls = MagicMock(side_effect=_FakeLGBMModel)

    with patch.dict("sys.modules", {"lightgbm": MagicMock(LGBMClassifier=fake_cls)}):
        yield fake_cls


def test_combo_template_registered():
    templates = TemplateRegistry.list_all()
    ids = [t.template_id for t in templates]
    assert "gnn_lightgbm_combo" in ids


def test_combo_template_meta():
    template = TemplateRegistry.get("gnn_lightgbm_combo")
    assert template.template_id == "gnn_lightgbm_combo"
    assert template.meta.is_combo is True
    assert template.meta.application_mode == ApplicationMode.CROSS_SECTIONAL


def test_combo_template_run(mock_lightgbm):
    """组合模板 run 测试——GNN 输出 embedding，LightGBM 消费 embedding 增强特征。"""
    template = TemplateRegistry.get("gnn_lightgbm_combo")

    base_features = pd.DataFrame({
        "momentum": [0.1, 0.5, 0.3, 0.8],
        "quality": [0.7, 0.4, 0.6, 0.2],
    })
    rank_labels = pd.Series([0, 1, 0, 1])
    graph_labels = pd.Series([0, 1, 0, 1])

    ctx = ComboContext(
        base_features=base_features,
        graph_data=base_features,
        graph_labels=graph_labels,
        rank_labels=rank_labels,
        gnn_config=TrainConfig(algorithm="gnn", application_mode=ApplicationMode.GRAPH_EMBEDDING),
        lgbm_config=TrainConfig(
            algorithm="lightgbm",
            application_mode=ApplicationMode.CROSS_SECTIONAL,
            hyper_params={"n_estimators": 10},
        ),
        signal_ctx=SignalContext(
            timestamp=1700000000,
            symbols=["A", "B", "C", "D"],
            top_k=2,
        ),
    )

    signals = template.run(ctx)
    assert len(signals) == 2
    assert all(s.side == "buy" for s in signals)
