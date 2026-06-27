"""AI 预测器测试"""

import numpy as np
import pandas as pd

from quantforge_ai.predictor import AIPredictor
from quantforge_ai.types import LabelType, TrainConfig


def _make_df(n: int = 30) -> pd.DataFrame:
    return pd.DataFrame({
        "close": [100.0 + i for i in range(n)],
        "volume": [1000.0 + i for i in range(n)],
    })


def test_make_labels_drops_unknown_future_return_before_binary_conversion():
    predictor = AIPredictor(TrainConfig(label_type=LabelType.ReturnBinary))
    forward_returns = pd.Series([0.1, -0.1, np.nan], index=[10, 11, 12])

    labels = predictor._make_labels(forward_returns, pd.Index([10, 11, 12]))

    assert labels.index.tolist() == [10, 11]
    assert labels.tolist() == [1, 0]


def test_predict_returns_empty_result_when_feature_window_has_no_rows():
    predictor = AIPredictor()

    class RejectTrainer:
        def predict(self, X):
            raise AssertionError("empty feature frame should not reach trainer")

    predictor._trainer = RejectTrainer()  # type: ignore[assignment]

    result = predictor.predict(_make_df(1))

    assert result.predictions == []
    assert result.probabilities == []


def test_predict_ignores_single_column_predict_proba():
    predictor = AIPredictor()

    class SingleClassTrainer:
        def predict(self, X):
            return np.ones(len(X), dtype=int)

        def predict_proba(self, X):
            return np.ones((len(X), 1))

    predictor._trainer = SingleClassTrainer()  # type: ignore[assignment]

    result = predictor.predict(_make_df())

    assert len(result.predictions) > 0
    assert result.probabilities == []
