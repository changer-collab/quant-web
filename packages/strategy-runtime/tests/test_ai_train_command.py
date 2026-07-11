"""aiTrain 命令模型持久化测试"""

import builtins
import importlib
import importlib.util
import sqlite3
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd

from quantforge_strategy.commands.ai_train import run_ai_train


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


def test_run_ai_train_with_template_id() -> None:
    """支持 template_id 字段，走模板分派路径。"""
    events = []

    def emit(event_type, data):
        events.append((event_type, data))

    mock_client = MagicMock()
    mock_client.query_bars_df.return_value = pd.DataFrame({
        "close": np.random.RandomState(0).randn(100).cumsum() + 100,
    })

    with patch("quantforge_strategy.commands.ai_train._load_dependencies") as mock_load:
        mock_load.return_value = (
            MagicMock(), MagicMock(), MagicMock(), MagicMock(), MagicMock(return_value=mock_client)
        )
        with patch("quantforge_strategy.commands.ai_train._run_with_template") as mock_template:
            mock_template.return_value = {"ok": True, "data": {"metrics": {"accuracy": 0.85}}}
            params = {
                "templateId": "random_forest_timing",
                "dataRange": {"dbPath": "test.db", "symbol": "000001.SZ", "timeframe": "1d"},
            }
            result = run_ai_train(params, emit)

            assert result["ok"] is True
            mock_template.assert_called_once()


def test_run_ai_train_backward_compatible_without_template_id() -> None:
    """无 template_id 时走旧路径（向后兼容）。"""
    from quantforge_ai import ModelMetrics

    events = []

    def emit(event_type, data):
        events.append((event_type, data))

    mock_client = MagicMock()
    mock_client.query_bars_df.return_value = pd.DataFrame({
        "close": np.random.RandomState(0).randn(100).cumsum() + 100,
    })

    with patch("quantforge_strategy.commands.ai_train._load_dependencies") as mock_load:
        mock_AIPredictor = MagicMock()
        mock_TrainConfig = MagicMock()
        mock_ModelType = MagicMock()
        mock_LabelType = MagicMock()
        mock_DataClient = MagicMock(return_value=mock_client)
        mock_load.return_value = (
            mock_AIPredictor, mock_TrainConfig, mock_ModelType, mock_LabelType, mock_DataClient
        )
        mock_predictor = MagicMock()
        mock_predictor.train.return_value = ModelMetrics(
            accuracy=0.8, precision=0.7, recall=0.6, f1=0.65, auc=0.9
        )
        mock_AIPredictor.return_value = mock_predictor

        params = {
            "modelType": "randomForest",
            "dataRange": {"dbPath": "test.db", "symbol": "000001.SZ", "timeframe": "1d"},
        }
        result = run_ai_train(params, emit)

        assert result["ok"] is True
        mock_AIPredictor.assert_called_once()


def test_run_ai_train_with_template_id_integration(tmp_path) -> None:
    """_run_with_template 集成测试——不 mock 函数本身，mock 其依赖，走通完整路径。

    覆盖 _run_with_template 内部逻辑：TemplateRegistry.get、DataClient 数据加载、
    FeatureExtractor.extract_all、TrainConfig 构造、AlgorithmRegistry.get、
    algorithm.train、algorithm.save、返回结构拼装。
    """
    from quantforge_algorithms.types import (
        ApplicationMode,
        ModelArtifact,
        ModelMetrics,
    )

    events = []

    def emit(event_type, data):
        events.append((event_type, data))

    class _FakeAlgorithm:
        """记录调用的 fake algorithm——train 返回真实 ModelArtifact，save 写假文件。"""

        def __init__(self) -> None:
            self.trained_with: tuple | None = None
            self.saved_artifact = None

        def train(self, X, y, config):
            self.trained_with = (X, y, config)
            return ModelArtifact(
                artifact_id="integration-artifact-id",
                algorithm="random_forest",
                model="fake-model",
                config=config,
                metrics=ModelMetrics(
                    accuracy=0.85,
                    precision=0.80,
                    recall=0.75,
                    f1=0.77,
                    auc=0.90,
                ),
                feature_schema=list(X.columns),
                application_mode=ApplicationMode.TIME_SERIES,
                trained_at=1700000000,
            )

        def save(self, artifact, path):
            model_file = Path(path)
            model_file.parent.mkdir(parents=True, exist_ok=True)
            model_file.write_text("fake model", encoding="utf-8")
            self.saved_artifact = artifact

    fake_algorithm = _FakeAlgorithm()
    model_path = tmp_path / "integration_model.joblib"

    bars_df = pd.DataFrame({"close": [100.0 + i for i in range(100)]})
    features_df = pd.DataFrame(
        {
            "f1": [float(i) for i in range(100)],
            "f2": [float(i * 2) for i in range(100)],
        }
    )

    with patch("quantforge_data.DataClient") as mock_data_client, \
         patch("quantforge_ai.features.FeatureExtractor.extract_all") as mock_extract, \
         patch("quantforge_algorithms.AlgorithmRegistry.get") as mock_algo_get:
        mock_data_client.return_value.query_bars_df.return_value = bars_df
        mock_extract.return_value = features_df
        mock_algo_get.return_value = fake_algorithm

        params = {
            "templateId": "random_forest_timing",
            "dataRange": {
                "dbPath": "fake.db",
                "symbol": "000001.SZ",
                "timeframe": "1d",
            },
            "modelPath": str(model_path),
        }
        result = run_ai_train(params, emit)

    # --- 返回结构验证 ---
    assert result["ok"] is True
    assert result["data"]["templateId"] == "random_forest_timing"
    assert result["data"]["artifactId"] == "integration-artifact-id"

    # --- metrics 验证（_to_dict 转换 ModelMetrics） ---
    assert result["data"]["metrics"]["accuracy"] == 0.85
    assert result["data"]["accuracy"] == 0.85
    assert result["data"]["auc"] == 0.90

    # --- 模型文件已写入 ---
    result_model_path = Path(result["data"]["modelPath"])
    assert result_model_path.exists()
    assert result_model_path.read_text(encoding="utf-8") == "fake model"

    # --- fake algorithm 收到正确调用 ---
    assert fake_algorithm.trained_with is not None
    X_trained, y_trained, config_trained = fake_algorithm.trained_with
    assert not X_trained.empty
    assert len(y_trained) == len(X_trained)
    assert config_trained.algorithm == "random_forest"
    assert config_trained.application_mode == ApplicationMode.TIME_SERIES
    # 模板默认超参（random_forest_timing: n_estimators=100, max_depth=5）
    assert config_trained.hyper_params["n_estimators"] == 100
    assert config_trained.hyper_params["max_depth"] == 5
    assert fake_algorithm.saved_artifact is not None

    # --- AlgorithmRegistry.get 用模板的 algorithm 字段分派 ---
    mock_algo_get.assert_called_once_with("random_forest")

    # --- DataClient 用 db_path 构造，query_bars_df 被调用 ---
    mock_data_client.assert_called_once_with("fake.db")
    mock_data_client.return_value.query_bars_df.assert_called_once()

    # --- FeatureExtractor.extract_all 被调用 ---
    mock_extract.assert_called_once()

    # --- 事件序列包含 progress 事件 ---
    progress_events = [e for e in events if e[0] == "progress"]
    assert len(progress_events) >= 2
    percents = [e[1]["percent"] for e in progress_events]
    assert 20 in percents
    assert 50 in percents
    assert 100 in percents
    # 也包含 log 事件
    assert any(e[0] == "log" for e in events)
