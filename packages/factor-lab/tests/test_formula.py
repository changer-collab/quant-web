"""公式因子测试"""

import numpy as np
import pandas as pd
import pytest

from quantforge_factor import FactorDefinition, FactorStatus
from quantforge_factor.formula import FormulaFactor
from quantforge_strategy import ResearchMode, TimeFrame


def _definition(formula: str) -> FactorDefinition:
    return FactorDefinition(
        id="formula_test",
        name="公式因子测试",
        formula=formula,
        category="test",
        modes=[ResearchMode.Traditional],
        frequency=TimeFrame.D1,
        status=FactorStatus.Active,
    )


def test_formula_factor_accepts_formula_string() -> None:
    df = pd.DataFrame({"open": [10.0, 20.0], "close": [11.0, 18.0]})
    factor = FormulaFactor("close / open - 1")

    result = factor.compute(df)

    expected = df["close"] / df["open"] - 1
    pd.testing.assert_series_equal(result, expected)


def test_formula_factor_computes_intraday_return() -> None:
    df = pd.DataFrame(
        {
            "open": [10.0, 20.0, 40.0],
            "close": [11.0, 18.0, 44.0],
            "high": [12.0, 21.0, 45.0],
            "low": [9.0, 17.0, 39.0],
            "volume": [1000, 1100, 1200],
            "turnover": [10000.0, 21000.0, 48000.0],
        }
    )
    factor = FormulaFactor(_definition("close / open - 1"))

    result = factor.compute(df)

    expected = df["close"] / df["open"] - 1
    pd.testing.assert_series_equal(result, expected)


def test_formula_factor_computes_pct_change_on_close() -> None:
    df = pd.DataFrame({"close": [10.0, 11.0, 12.0, 13.0, 14.0, 16.0, 18.0]})
    factor = FormulaFactor(_definition("pct_change(5)"))

    result = factor.compute(df)

    expected = df["close"].pct_change(5)
    pd.testing.assert_series_equal(result, expected)


def test_formula_factor_computes_price_deviation_from_rolling_mean() -> None:
    df = pd.DataFrame({"close": [float(i) for i in range(1, 26)]})
    factor = FormulaFactor(_definition("close / rolling_mean(close, 20) - 1"))

    result = factor.compute(df)

    expected = df["close"] / df["close"].rolling(20).mean() - 1
    pd.testing.assert_series_equal(result, expected)


def test_formula_factor_explicit_series_functions_do_not_require_close_column() -> None:
    df = pd.DataFrame({"volume": [100.0, 120.0, 180.0], "turnover": [1000.0, 1500.0, 2400.0]})

    pd.testing.assert_series_equal(
        FormulaFactor(_definition("rolling_mean(volume, 2)")).compute(df),
        df["volume"].rolling(2).mean(),
    )
    pd.testing.assert_series_equal(
        FormulaFactor(_definition("shift(turnover, 1)")).compute(df),
        df["turnover"].shift(1),
    )


def test_formula_factor_rejects_non_positive_windows() -> None:
    df = pd.DataFrame({"close": [10.0, 11.0, 12.0]})

    with pytest.raises(ValueError):
        FormulaFactor(_definition("shift(close, -1)")).compute(df)
    with pytest.raises(ValueError):
        FormulaFactor(_definition("rolling_mean(close, 0)")).compute(df)


def test_formula_factor_rejects_extra_function_arguments() -> None:
    df = pd.DataFrame({"close": [10.0, 11.0, 12.0], "open": [9.0, 10.0, 11.0]})

    with pytest.raises(ValueError):
        FormulaFactor(_definition("log(close, open)")).compute(df)
    with pytest.raises(ValueError):
        FormulaFactor(_definition("rank(close, open)")).compute(df)


def test_formula_factor_supports_remaining_safe_functions() -> None:
    df = pd.DataFrame(
        {
            "close": [1.0, 2.0, 4.0, 8.0],
            "volume": [400.0, 100.0, 300.0, 200.0],
            "turnover": [4.0, 8.0, 16.0, 32.0],
        }
    )

    pd.testing.assert_series_equal(
        FormulaFactor(_definition("rolling_std(close, 2)")).compute(df),
        df["close"].rolling(2).std(),
    )
    pd.testing.assert_series_equal(
        FormulaFactor(_definition("shift(volume, 1)")).compute(df),
        df["volume"].shift(1),
    )
    pd.testing.assert_series_equal(
        FormulaFactor(_definition("log(turnover)")).compute(df),
        np.log(df["turnover"]),
    )
    pd.testing.assert_series_equal(
        FormulaFactor(_definition("rank(volume)")).compute(df),
        df["volume"].rank(),
    )


def test_formula_factor_rejects_unsafe_formula_when_created() -> None:
    with pytest.raises(ValueError):
        FormulaFactor(_definition("import os; os.system('ls')"))


def test_formula_factor_rejects_boolean_constants() -> None:
    with pytest.raises(ValueError):
        FormulaFactor(_definition("close + True"))


def test_formula_factor_rejects_non_string_formula() -> None:
    with pytest.raises(ValueError):
        FormulaFactor(_definition(None))


def test_formula_factor_rejects_attribute_calls() -> None:
    with pytest.raises(ValueError):
        FormulaFactor(_definition("close.shift(5)"))
