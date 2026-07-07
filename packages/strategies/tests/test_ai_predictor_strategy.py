"""测试 AIModelStrategy（原 AIPredictorStrategy）。"""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest

from quantforge_strategy import Bar, Signal, TimeFrame


def test_ai_model_strategy_meta():
    from quantforge_strategies.combined.ai_predictor import AIModelStrategy
    strategy = AIModelStrategy()
    meta = strategy.meta
    assert meta.name == "ai_predictor"
    assert meta.kind.value == "timing"


def test_ai_model_strategy_registered_as_ai_predictor():
    """注册名保持 ai_predictor 不变。"""
    from quantforge_strategies import get
    strategy_cls = get("ai_predictor")
    assert strategy_cls.__name__ == "AIModelStrategy"


def test_ai_model_strategy_init_loads_artifact(tmp_path):
    from quantforge_strategies.combined.ai_predictor import AIModelStrategy

    strategy = AIModelStrategy(model_path=str(tmp_path / "model.joblib"))
    with patch("quantforge_strategies.combined.ai_predictor._load_artifact") as mock_load:
        mock_artifact = MagicMock()
        mock_load.return_value = mock_artifact
        strategy.init(context=None)
        mock_load.assert_called_once()


def test_ai_model_strategy_on_bar_returns_hold_below_min_history():
    from quantforge_strategies.combined.ai_predictor import AIModelStrategy
    strategy = AIModelStrategy(min_history=21)
    strategy._predictor = MagicMock()
    bar = Bar(symbol="000001.SZ", timeframe=TimeFrame.D1, timestamp=1,
              open=10, high=11, low=9, close=10, volume=1000)
    result = strategy.on_bar(bar, context=None)
    assert result == Signal.Hold
