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
    with patch("quantforge_strategies.combined.ai_predictor._load_artifact_by_id") as mock_load:
        mock_artifact = MagicMock()
        mock_load.return_value = mock_artifact
        strategy.init(context=None)
        mock_load.assert_called_once_with("model")
        assert strategy._artifact is mock_artifact


def test_ai_model_strategy_on_bar_returns_hold_below_min_history():
    from quantforge_strategies.combined.ai_predictor import AIModelStrategy
    strategy = AIModelStrategy(min_history=21)
    strategy._predictor = MagicMock()
    bar = Bar(symbol="000001.SZ", timeframe=TimeFrame.D1, timestamp=1,
              open=10, high=11, low=9, close=10, volume=1000)
    result = strategy.on_bar(bar, context=None)
    assert result == Signal.Hold


def test_ml_signal_to_strategy_signal_mapping():
    """MLSignal.side 映射到 strategy-runtime Signal 枚举：buy→Buy, sell→Sell, hold→Hold。"""
    from quantforge_strategies.combined.ai_predictor import _ml_signal_to_strategy_signal
    from quantforge_algorithms.types import MLSignal

    buy = MLSignal(timestamp=1, symbol="000001.SZ", side="buy")
    sell = MLSignal(timestamp=2, symbol="000001.SZ", side="sell")
    hold = MLSignal(timestamp=3, symbol="000001.SZ", side="hold")

    assert _ml_signal_to_strategy_signal(buy) == Signal.Buy
    assert _ml_signal_to_strategy_signal(sell) == Signal.Sell
    assert _ml_signal_to_strategy_signal(hold) == Signal.Hold


def test_raw_output_to_signal_threshold_mapping():
    """原始概率输出按 threshold 映射到 MLSignal：>=threshold→buy, <=1-threshold→sell, 其余→hold。"""
    from quantforge_strategies.combined.ai_predictor import _raw_output_to_signal

    bar = Bar(symbol="000001.SZ", timeframe=TimeFrame.D1, timestamp=1,
              open=10, high=11, low=9, close=10, volume=1000)
    threshold = 0.7

    # buy: prob >= threshold
    buy = _raw_output_to_signal(0.8, threshold, bar)
    assert buy.side == "buy"
    assert buy.probability == 0.8
    assert buy.timestamp == 1
    assert buy.symbol == "000001.SZ"

    # sell: prob <= 1 - threshold (0.3)
    sell = _raw_output_to_signal(0.2, threshold, bar)
    assert sell.side == "sell"
    assert sell.probability == 0.2

    # hold: 1 - threshold < prob < threshold
    hold = _raw_output_to_signal(0.5, threshold, bar)
    assert hold.side == "hold"
    assert hold.probability == 0.5

    # numpy 标量同样走数值分支
    np_buy = _raw_output_to_signal(np.float64(0.9), threshold, bar)
    assert np_buy.side == "buy"
    assert np_buy.probability == 0.9


def test_predict_artifact_delegates_to_algorithm_registry():
    """_predict_artifact 通过 AlgorithmRegistry.get 获取算法并调用 predict，返回原始输出。"""
    from collections import deque
    from quantforge_strategies.combined.ai_predictor import _predict_artifact

    bars = deque([
        Bar(symbol="000001.SZ", timeframe=TimeFrame.D1, timestamp=1,
            open=10, high=11, low=9, close=10, volume=1000),
        Bar(symbol="000001.SZ", timeframe=TimeFrame.D1, timestamp=2,
            open=10.5, high=11.5, low=9.5, close=10.5, volume=1200),
    ])

    artifact = MagicMock()
    artifact.algorithm = "random_forest"

    mock_algorithm = MagicMock()
    expected_output = np.array([0.85])
    mock_algorithm.predict.return_value = expected_output

    with patch("quantforge_algorithms.AlgorithmRegistry.get", return_value=mock_algorithm) as mock_get:
        result = _predict_artifact(artifact, bars)

    # 用 artifact.algorithm 名字查找算法
    mock_get.assert_called_once_with("random_forest")
    # predict 以 artifact 和 DataFrame 为参数
    mock_algorithm.predict.assert_called_once()
    call_args = mock_algorithm.predict.call_args
    assert call_args.args[0] is artifact
    assert isinstance(call_args.args[1], pd.DataFrame)
    assert len(call_args.args[1]) == 2
    # 返回算法的原始输出，不做包装
    assert result is expected_output
