"""因子基类测试"""

import pandas as pd
import numpy as np

from quantforge_factor import Factor, FactorDefinition, FactorStatus
from quantforge_strategy import TimeFrame, ResearchMode


class MomentumFactor(Factor):
    @property
    def definition(self) -> FactorDefinition:
        return FactorDefinition(
            id="momentum_5d",
            name="5日动量",
            formula="close / close.shift(5) - 1",
            category="momentum",
            modes=[ResearchMode.Traditional],
            frequency=TimeFrame.D1,
            status=FactorStatus.Active,
        )

    def compute(self, df: pd.DataFrame) -> pd.Series:
        return df["close"] / df["close"].shift(5) - 1


def test_factor_definition():
    f = MomentumFactor()
    assert f.definition.id == "momentum_5d"
    assert f.definition.category == "momentum"
    assert f.definition.status == FactorStatus.Active


def test_factor_compute():
    f = MomentumFactor()
    df = pd.DataFrame({"close": [10, 11, 12, 13, 14, 15, 16]})
    result = f.compute(df)
    assert len(result) == 7
    # 第5个值: close[5]=15 / close[0]=10 - 1 = 0.5
    assert round(result.iloc[5], 4) == 0.5
