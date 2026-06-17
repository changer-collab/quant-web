"""AI 训练命令"""

from __future__ import annotations

import dataclasses
from typing import Any

import pandas as pd

from quantforge_ai import AIPredictor, TrainConfig, ModelType, LabelType
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame


def run_ai_train(params: dict[str, Any]) -> dict[str, Any]:
    model_type = ModelType(params.get("modelType", "randomForest"))
    data_range = params.get("dataRange", {})

    db_path = data_range.get("dbPath", "data/quant.db")
    symbol = data_range.get("symbol", "")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))

    client = DataClient(db_path)
    df = client.query_bars_df(symbol, timeframe)

    if df.empty:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol}"}}

    config = TrainConfig(
        model_type=model_type,
        label_type=LabelType(params.get("labelType", "returnBinary")),
        test_size=params.get("testSize", 0.2),
    )

    predictor = AIPredictor(config)
    forward_returns = df["close"].pct_change().shift(-1)
    metrics = predictor.train(df, forward_returns)

    return {"ok": True, "data": _to_dict(metrics)}


def _to_dict(obj):
    if dataclasses.is_dataclass(obj):
        return {f: _to_dict(getattr(obj, f)) for f in obj.__dataclass_fields__}
    if isinstance(obj, (int, float, str, bool)) or obj is None:
        return obj
    if hasattr(obj, "value"):
        return obj.value
    return str(obj)
