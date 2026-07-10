"""AI 模型策略——引用已训练 ModelArtifact + SignalGenerator 生成信号。

原 AIPredictorStrategy 重构为 AIModelStrategy，注册名保持 ai_predictor。
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

import numpy as np

from quantforge_strategy import (
    TimingStrategy, StrategyMeta, StrategyResult,
    Bar, Signal, ParamType, ResearchMode, StrategyKind, StrategyParamDef,
    StrategyCategory, StrategySubcategory,
)


class AIModelStrategy(TimingStrategy):
    """基于已训练 AI 模型 artifact + SignalGenerator 输出 Buy/Sell/Hold 信号。

    不再硬编码 AIPredictor，通过 model_artifact_path 加载 ModelArtifact，
    通过 AlgorithmRegistry 获取算法进行 predict。
    """

    def __init__(
        self,
        model_id: str = "randomForest",
        min_history: int = 21,
        threshold: float = 0.5,
        **kwargs: Any,
    ) -> None:
        # 向后兼容：旧配置仍传 model_path / modelPath
        legacy_path = kwargs.pop("model_path", None) or kwargs.pop("modelPath", None)
        if legacy_path:
            from pathlib import Path
            self._model_id = Path(legacy_path).stem
        else:
            self._model_id = model_id
        self._min_history = max(min_history, 21)
        self._threshold = threshold
        self._bars_by_symbol: defaultdict[str, deque[Bar]] = defaultdict(
            lambda: deque(maxlen=self._min_history)
        )
        self._artifact: Any | None = None

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="ai_predictor",
            description="AI 模型预测择时策略（基于 ModelArtifact + SignalGenerator）",
            modes=[ResearchMode.AI],
            params=[
                StrategyParamDef(
                    key="model_id",
                    label="模型选择",
                    type=ParamType.Select,
                    default=self._model_id,
                    options=list_available_model_ids(),
                ),
                StrategyParamDef(
                    key="min_history",
                    label="最少历史 Bar 数",
                    type=ParamType.Number,
                    default=self._min_history,
                    min=21,
                    max=250,
                ),
                StrategyParamDef(
                    key="threshold",
                    label="信号置信阈值",
                    type=ParamType.Number,
                    default=self._threshold,
                    min=0.0,
                    max=1.0,
                ),
            ],
            version="0.2.0",
            kind=StrategyKind.Timing,
            category=StrategyCategory.NON_FACTOR,
            subcategory=StrategySubcategory.E2E_AI_TIMESERIES,
        )

    def init(self, context) -> None:
        self._bars_by_symbol.clear()
        self._artifact = _load_artifact_by_id(self._model_id)

    def signal(self, bar: Bar, context) -> Signal:
        return self.on_bar(bar, context)

    def on_bar(self, bar: Bar, context) -> Signal:
        bars = self._bars_by_symbol[bar.symbol]
        bars.append(bar)
        if len(bars) < self._min_history:
            return Signal.Hold
        if self._artifact is None:
            raise RuntimeError("AIModelStrategy not initialized")

        raw_output = _predict_artifact(self._artifact, bars)
        if len(raw_output) == 0:
            return Signal.Hold

        ml_signal = _raw_output_to_signal(raw_output[-1], self._threshold, bar)
        return _ml_signal_to_strategy_signal(ml_signal)

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


# 向后兼容别名
AIPredictorStrategy = AIModelStrategy


def _load_artifact_by_id(model_id: str):
    """按 model_id 加载 ModelArtifact——从 data/models/<id>.joblib 读取。"""
    from pathlib import Path
    import joblib
    from quantforge_algorithms import AlgorithmRegistry

    path = Path("data/models") / f"{model_id}.joblib"
    if not path.exists():
        raise FileNotFoundError(f"Model artifact not found: {path}")
    payload = joblib.load(path)
    algorithm_name = payload.get("algorithm")
    if not algorithm_name:
        config = payload.get("config", {})
        if isinstance(config, dict):
            algorithm_name = config.get("algorithm", "random_forest")
        else:
            algorithm_name = getattr(config, "algorithm", "random_forest")
    algorithm = AlgorithmRegistry.get(algorithm_name)
    return algorithm.load(path)


def list_available_model_ids() -> list[str]:
    """扫描 data/models/ 目录，返回可用 model_id 列表（文件名不含扩展名）。"""
    from pathlib import Path

    models_dir = Path("data/models")
    if not models_dir.exists():
        return []
    return sorted(p.stem for p in models_dir.glob("*.joblib"))


def _predict_artifact(artifact, bars: deque[Bar]):
    """使用 Algorithm.predict 对 bar 序列做预测。"""
    from quantforge_algorithms import AlgorithmRegistry

    algorithm = AlgorithmRegistry.get(artifact.algorithm)
    X = _bars_to_frame(bars)
    return algorithm.predict(artifact, X)


def _raw_output_to_signal(prediction: float, threshold: float, bar: Bar):
    """把算法原始输出转换为 MLSignal（简化版，不经过 SignalGenerator 以保持时序策略轻量）。"""
    from quantforge_algorithms.types import MLSignal

    if isinstance(prediction, (int, float, np.integer, np.floating)):
        prob = float(prediction)
        if prob >= threshold:
            side = "buy"
        elif prob <= 1 - threshold:
            side = "sell"
        else:
            side = "hold"
        return MLSignal(
            timestamp=bar.timestamp,
            symbol=bar.symbol,
            side=side,
            probability=prob,
        )
    return MLSignal(timestamp=bar.timestamp, symbol=bar.symbol, side="hold")


def _ml_signal_to_strategy_signal(ml_signal) -> Signal:
    """把 MLSignal 转换为 strategy-runtime 的 Signal 枚举。"""
    if ml_signal.side == "buy":
        return Signal.Buy
    if ml_signal.side == "sell":
        return Signal.Sell
    return Signal.Hold


def _bars_to_frame(bars: deque[Bar]):
    import pandas as pd

    return pd.DataFrame([
        {
            "symbol": bar.symbol,
            "timeframe": bar.timeframe.value,
            "timestamp": bar.timestamp,
            "open": bar.open,
            "high": bar.high,
            "low": bar.low,
            "close": bar.close,
            "volume": bar.volume,
        }
        for bar in bars
    ])
