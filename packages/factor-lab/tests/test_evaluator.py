"""因子评估器测试"""

import pandas as pd
import numpy as np

from quantforge_factor import Factor, FactorDefinition, FactorStatus, FactorEvaluator
from quantforge_strategy import TimeFrame, ResearchMode


class SimpleFactor(Factor):
    @property
    def definition(self) -> FactorDefinition:
        return FactorDefinition(
            id="test_factor", name="测试因子", formula="close",
            category="test", modes=[ResearchMode.Traditional],
            frequency=TimeFrame.D1, status=FactorStatus.Active,
        )

    def compute(self, df: pd.DataFrame) -> pd.Series:
        return df["close"]


def test_calc_ic():
    evaluator = FactorEvaluator()
    fv = pd.Series([1, 2, 3, 4, 5], dtype=float)
    fr = pd.Series([0.1, 0.2, 0.3, 0.4, 0.5], dtype=float)
    ic = evaluator.calc_ic(fv, fr)
    assert ic > 0.9  # 强正相关


def test_calc_rank_ic():
    evaluator = FactorEvaluator()
    fv = pd.Series([1, 2, 3, 4, 5], dtype=float)
    fr = pd.Series([0.1, 0.2, 0.3, 0.4, 0.5], dtype=float)
    rank_ic = evaluator.calc_rank_ic(fv, fr)
    assert rank_ic > 0.9


def test_calc_group_returns():
    evaluator = FactorEvaluator(n_groups=3)
    np.random.seed(42)
    fv = pd.Series(np.random.randn(100))
    fr = pd.Series(np.random.randn(100))
    result = evaluator.calc_group_returns(fv, fr)
    assert len(result) == 3


def test_evaluate():
    evaluator = FactorEvaluator()
    factor = SimpleFactor()
    np.random.seed(42)
    n = 100
    df = pd.DataFrame({"close": np.random.randn(n) + 10})
    forward_returns = pd.Series(np.random.randn(n) * 0.01)
    result = evaluator.evaluate(factor, df, forward_returns)
    assert result.factor_id == "test_factor"
    assert result.metrics.ic != 0.0 or result.metrics.rank_ic != 0.0
