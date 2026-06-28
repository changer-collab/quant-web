"""AI 训练命令"""

from __future__ import annotations

import dataclasses
from pathlib import Path
from typing import Any, Callable

from quantforge_strategy import TimeFrame

AIPredictor = None
TrainConfig = None
ModelType = None
LabelType = None
DataClient = None


def run_ai_train(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
    _AIPredictor, _TrainConfig, _ModelType, _LabelType, _DataClient = _load_dependencies()
    _emit = emit or (lambda *a, **kw: None)

    model_type = _ModelType(params.get("modelType", "randomForest"))
    data_range = params.get("dataRange", {})

    db_path = data_range.get("dbPath", "data/quant.db")
    symbol = data_range.get("symbol", "")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))

    _emit("log", {"level": "info", "message": f"Loading data for AI training: {symbol} {timeframe.value}"})

    client = _DataClient(db_path)
    df = client.query_bars_df(symbol, timeframe)

    if df.empty:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol}"}}

    _emit("progress", {"percent": 20, "message": f"Loaded {len(df)} bars, preparing features"})

    config = _TrainConfig(
        model_type=model_type,
        label_type=_LabelType(params.get("labelType", "returnBinary")),
        test_size=params.get("testSize", 0.2),
    )

    _emit("progress", {"percent": 50, "message": "Training model"})

    predictor = _AIPredictor(config)
    forward_returns = df["close"].pct_change().shift(-1)
    metrics = predictor.train(df, forward_returns)

    model_path = _resolve_model_path(params, model_type.value, symbol, timeframe.value)
    predictor.save(model_path)

    _emit("progress", {"percent": 100, "message": "Training complete"})

    metrics_dict = _to_dict(metrics)
    return {
        "ok": True,
        "data": {**metrics_dict, "metrics": metrics_dict, "modelPath": str(model_path)},
    }


def _load_dependencies():
    global AIPredictor, TrainConfig, ModelType, LabelType, DataClient

    if AIPredictor is None:
        from quantforge_ai import AIPredictor as _AIPredictor
        AIPredictor = _AIPredictor
    if TrainConfig is None or ModelType is None or LabelType is None:
        from quantforge_ai import LabelType as _LabelType
        from quantforge_ai import ModelType as _ModelType
        from quantforge_ai import TrainConfig as _TrainConfig
        TrainConfig = _TrainConfig
        ModelType = _ModelType
        LabelType = _LabelType
    if DataClient is None:
        from quantforge_data import DataClient as _DataClient
        DataClient = _DataClient
    return AIPredictor, TrainConfig, ModelType, LabelType, DataClient


def _resolve_model_path(params: dict[str, Any], model_type: str, symbol: str, timeframe: str) -> Path:
    explicit_path = params.get("modelPath") or params.get("outputPath")
    if explicit_path:
        return Path(explicit_path).expanduser().resolve()

    model_name = Path(str(params.get("modelName") or model_type)).name
    if not model_name.endswith(".joblib"):
        model_name = f"{model_name}.joblib"
    return (Path.cwd() / "data" / "models" / model_name).resolve()


def _to_dict(obj):
    if dataclasses.is_dataclass(obj):
        return {f: _to_dict(getattr(obj, f)) for f in obj.__dataclass_fields__}
    if isinstance(obj, (int, float, str, bool)) or obj is None:
        return obj
    if hasattr(obj, "value"):
        return obj.value
    return str(obj)
