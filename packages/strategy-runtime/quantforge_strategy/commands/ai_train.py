"""AI 训练命令"""

from __future__ import annotations

import dataclasses
from typing import Any, Callable

import pandas as pd

from quantforge_ai import AIPredictor, TrainConfig, ModelType, LabelType
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame


def run_ai_train(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
    _emit = emit or (lambda *a, **kw: None)

    model_type = ModelType(params.get("modelType", "randomForest"))
    data_range = params.get("dataRange", {})

    db_path = data_range.get("dbPath", "data/quant.db")
    symbol = data_range.get("symbol", "")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))

    _emit("log", {"level": "info", "message": f"Loading data for AI training: {symbol} {timeframe.value}"})

    client = DataClient(db_path)
    df = client.query_bars_df(symbol, timeframe)

    if df.empty:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol}"}}

    _emit("progress", {"percent": 20, "message": f"Loaded {len(df)} bars, preparing features"})

    config = TrainConfig(
        model_type=model_type,
        label_type=LabelType(params.get("labelType", "returnBinary")),
        test_size=params.get("testSize", 0.2),
    )

    _emit("progress", {"percent": 50, "message": "Training model"})

    predictor = AIPredictor(config)
    forward_returns = df["close"].pct_change().shift(-1)
    metrics = predictor.train(df, forward_returns)

    _emit("progress", {"percent": 100, "message": "Training complete"})

    return {"ok": True, "data": _to_dict(metrics)}


def _to_dict(obj):
    if dataclasses.is_dataclass(obj):
        return {f: _to_dict(getattr(obj, f)) for f in obj.__dataclass_fields__}
    if isinstance(obj, (int, float, str, bool)) or obj is None:
        return obj
    if hasattr(obj, "value"):
        return obj.value
    return str(obj)
