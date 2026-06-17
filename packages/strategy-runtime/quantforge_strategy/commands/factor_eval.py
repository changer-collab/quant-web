"""因子评估命令"""

from __future__ import annotations

import dataclasses
import json
from typing import Any

import pandas as pd

from quantforge_factor import Factor, FactorDefinition, FactorEvaluator
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame


def run_factor_eval(params: dict[str, Any]) -> dict[str, Any]:
    factor_info = params["factor"]
    data_range = params.get("dataRange", {})

    db_path = data_range.get("dbPath", "data/quant.db")
    symbol = data_range.get("symbol", "")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))

    client = DataClient(db_path)
    df = client.query_bars_df(symbol, timeframe)

    if df.empty:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol}"}}

    # 计算前向收益
    forward_returns = df["close"].pct_change().shift(-1).dropna()

    # 构建因子（简单方式：用公式名从注册表或直接计算）
    factor = _make_factor(factor_info)
    evaluator = FactorEvaluator()
    result = evaluator.evaluate(factor, df, forward_returns)

    return {"ok": True, "data": _to_dict(result)}


def _make_factor(info: dict) -> Factor:
    from quantforge_factor import Factor, FactorDefinition, FactorStatus
    from quantforge_strategy import ResearchMode

    definition = FactorDefinition(
        id=info.get("id", "custom"),
        name=info.get("name", "custom"),
        formula=info.get("formula", "close"),
        category=info.get("category", "custom"),
        modes=[ResearchMode(m) for m in info.get("modes", ["traditional"])],
        frequency=TimeFrame(info.get("frequency", "1d")),
        status=FactorStatus.Active,
    )

    class SimpleFactor(Factor):
        @property
        def definition(self):
            return definition

        def compute(self, df: pd.DataFrame) -> pd.Series:
            return df["close"]

    return SimpleFactor()


def _to_dict(obj):
    if dataclasses.is_dataclass(obj):
        return {f: _to_dict(getattr(obj, f)) for f in obj.__dataclass_fields__}
    if isinstance(obj, list):
        return [_to_dict(i) for i in obj]
    if isinstance(obj, (int, float, str, bool)) or obj is None:
        return obj
    if hasattr(obj, "value"):
        return obj.value
    return str(obj)
