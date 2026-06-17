"""特征提取器测试"""

import pandas as pd
import numpy as np

from quantforge_ai.features import FeatureExtractor


def _make_df(n: int = 50) -> pd.DataFrame:
    np.random.seed(42)
    return pd.DataFrame({
        "close": 100 + np.cumsum(np.random.randn(n) * 0.5),
        "volume": np.random.randint(1000, 5000, n).astype(float),
    })


def test_returns():
    df = _make_df()
    result = FeatureExtractor.returns(df["close"])
    assert "return_1" in result.columns
    assert "return_5" in result.columns
    assert len(result) == len(df)


def test_volatility():
    df = _make_df()
    result = FeatureExtractor.volatility(df["close"])
    assert "volatility_5" in result.columns


def test_volume_features():
    df = _make_df()
    result = FeatureExtractor.volume_features(df["volume"])
    assert "volume_ratio_5" in result.columns


def test_extract_all():
    df = _make_df()
    result = FeatureExtractor.extract_all(df)
    assert len(result.columns) > 5
