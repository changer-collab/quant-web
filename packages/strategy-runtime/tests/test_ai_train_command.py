"""aiTrain 命令模型持久化测试"""

import builtins
import importlib
import importlib.util
import sqlite3
import sys
from pathlib import Path


class _FakePredictor:
    saved_path: Path | None = None

    def __init__(self, config):
        self.config = config

    def train(self, df, forward_returns):
        from quantforge_ai import ModelMetrics

        assert not df.empty
        assert len(forward_returns) == len(df)
        return ModelMetrics(accuracy=0.8, precision=0.7, recall=0.6, f1=0.65, auc=0.9)

    def save(self, path):
        model_path = Path(path)
        model_path.parent.mkdir(parents=True, exist_ok=True)
        model_path.write_text("fake model", encoding="utf-8")
        _FakePredictor.saved_path = model_path


def _create_bars_db(path: Path, n: int = 30) -> None:
    conn = sqlite3.connect(path)
    try:
        conn.execute(
            """
            CREATE TABLE bars (
                symbol TEXT,
                timeframe TEXT,
                timestamp INTEGER,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume REAL
            )
            """
        )
        rows = [
            ("TEST", "1d", i, 100.0 + i, 101.0 + i, 99.0 + i, 100.5 + i, 1000.0 + i)
            for i in range(n)
        ]
        conn.executemany("INSERT INTO bars VALUES (?, ?, ?, ?, ?, ?, ?, ?)", rows)
        conn.commit()
    finally:
        conn.close()


def test_ai_train_module_delays_downstream_imports(monkeypatch) -> None:
    blocked = {"quantforge_ai", "quantforge_data"}
    original_import = builtins.__import__

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name.split(".", 1)[0] in blocked:
            raise AssertionError(f"unexpected eager import: {name}")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", guarded_import)
    module_path = Path(__file__).parents[1] / "quantforge_strategy" / "commands" / "ai_train.py"
    spec = importlib.util.spec_from_file_location("ai_train_delay_import_test", module_path)
    module = importlib.util.module_from_spec(spec)

    assert spec.loader is not None
    spec.loader.exec_module(module)
    assert hasattr(module, "run_ai_train")


def test_commands_package_does_not_eager_import_sibling_dependencies(monkeypatch) -> None:
    for name in list(sys.modules):
        if name == "quantforge_strategy.commands" or name.startswith("quantforge_strategy.commands."):
            monkeypatch.delitem(sys.modules, name, raising=False)

    blocked = {"quantforge_backtest", "quantforge_factor", "quantforge_ai", "quantforge_data", "quantforge_strategies"}
    original_import = builtins.__import__

    def guarded_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name.split(".", 1)[0] in blocked:
            raise AssertionError(f"unexpected eager import: {name}")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", guarded_import)

    module = importlib.import_module("quantforge_strategy.commands.ai_train")

    assert hasattr(module, "run_ai_train")


def test_run_ai_train_saves_model_to_default_data_models_path(monkeypatch, tmp_path) -> None:
    from quantforge_strategy.commands import ai_train

    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(ai_train, "AIPredictor", _FakePredictor)
    _FakePredictor.saved_path = None
    db_path = tmp_path / "bars.sqlite"
    _create_bars_db(db_path)

    result = ai_train.run_ai_train({
        "modelType": "randomForest",
        "dataRange": {"dbPath": str(db_path), "symbol": "TEST", "timeframe": "1d"},
    })

    model_path = tmp_path / "data" / "models" / "randomForest.joblib"
    assert result["ok"] is True
    assert _FakePredictor.saved_path == model_path
    assert model_path.exists()
    assert result["data"]["metrics"]["accuracy"] == 0.8
    assert result["data"]["modelPath"] == str(model_path)


def test_resolve_model_path_keeps_model_name_inside_data_models(monkeypatch, tmp_path) -> None:
    from quantforge_strategy.commands.ai_train import _resolve_model_path

    monkeypatch.chdir(tmp_path)

    model_path = _resolve_model_path({"modelName": "../escape"}, "randomForest", "TEST", "1d")

    assert model_path == tmp_path / "data" / "models" / "escape.joblib"
