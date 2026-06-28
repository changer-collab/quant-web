"""factorEval 命令公式因子构建测试"""

import builtins
import importlib.util
import sys
import types
from pathlib import Path

import pandas as pd


def test_factor_eval_module_delays_downstream_imports(monkeypatch) -> None:
    blocked = {"quantforge_factor", "quantforge_data"}
    original_import = builtins.__import__

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name.split(".", 1)[0] in blocked:
            raise AssertionError(f"unexpected eager import: {name}")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", guarded_import)
    module_path = Path(__file__).parents[1] / "quantforge_strategy" / "commands" / "factor_eval.py"
    spec = importlib.util.spec_from_file_location("factor_eval_delay_import_test", module_path)
    module = importlib.util.module_from_spec(spec)

    assert spec.loader is not None
    spec.loader.exec_module(module)
    assert hasattr(module, "run_factor_eval")


def test_make_factor_rejects_missing_formula() -> None:
    from quantforge_strategy.commands.factor_eval import _make_factor

    try:
        _make_factor({"id": "momentum_5d"})
    except ValueError as exc:
        assert str(exc) == "factor.formula is required"
    else:
        raise AssertionError("missing formula should be rejected")


def test_run_factor_eval_returns_validation_error_for_illegal_formula(monkeypatch) -> None:
    from quantforge_strategy.commands.factor_eval import run_factor_eval

    class FakeClient:
        def __init__(self, db_path):
            self.db_path = db_path

        def query_bars_df(self, symbol, timeframe):
            return pd.DataFrame({"open": [10.0, 11.0], "close": [11.0, 12.0]})

    fake_data = types.ModuleType("quantforge_data")
    fake_data.DataClient = FakeClient
    monkeypatch.setitem(sys.modules, "quantforge_data", fake_data)

    result = run_factor_eval({"factor": {"formula": "import os"}, "dataRange": {"symbol": "TEST"}})

    assert result == {
        "ok": False,
        "error": {"code": "INVALID_FACTOR_FORMULA", "message": "Illegal formula"},
    }


def test_make_factor_uses_formula_instead_of_close_stub() -> None:
    from quantforge_strategy.commands.factor_eval import _make_factor

    factor = _make_factor({"id": "custom", "formula": "close / open"})
    df = pd.DataFrame({"open": [10.0, 20.0, 40.0], "close": [20.0, 30.0, 80.0]})

    result = factor.compute(df)

    expected = df["close"] / df["open"]
    pd.testing.assert_series_equal(result, expected)
    assert not result.equals(df["close"])
