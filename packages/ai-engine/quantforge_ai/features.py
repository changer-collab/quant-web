"""特征提取器"""

from __future__ import annotations

import numpy as np
import pandas as pd


class FeatureExtractor:
    """从行情数据提取 ML 特征"""

    @staticmethod
    def returns(close: pd.Series, periods: list[int] | None = None) -> pd.DataFrame:
        periods = periods or [1, 5, 10, 20]
        result = {}
        for p in periods:
            result[f"return_{p}"] = close.pct_change(p)
        return pd.DataFrame(result)

    @staticmethod
    def volatility(close: pd.Series, windows: list[int] | None = None) -> pd.DataFrame:
        windows = windows or [5, 10, 20]
        result = {}
        for w in windows:
            result[f"volatility_{w}"] = close.pct_change().rolling(w).std()
        return pd.DataFrame(result)

    @staticmethod
    def volume_features(volume: pd.Series, windows: list[int] | None = None) -> pd.DataFrame:
        windows = windows or [5, 10, 20]
        result = {}
        for w in windows:
            result[f"volume_ratio_{w}"] = volume / volume.rolling(w).mean()
        return pd.DataFrame(result)

    @classmethod
    def extract_all(cls, df: pd.DataFrame) -> pd.DataFrame:
        """提取全部特征"""
        parts = [
            cls.returns(df["close"]),
            cls.volatility(df["close"]),
            cls.volume_features(df["volume"]),
        ]
        return pd.concat(parts, axis=1)
