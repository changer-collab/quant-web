"""AI 预测择时策略"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from quantforge_strategy import (
    TimingStrategy, StrategyMeta, StrategyResult,
    Bar, Signal, ParamType, ResearchMode, StrategyKind, StrategyParamDef,
)

AIPredictor = None


class AIPredictorStrategy(TimingStrategy):
    """基于已训练 AI 模型输出 Buy/Sell/Hold 信号。"""

    def __init__(
        self,
        model_path: str = "data/models/randomForest.joblib",
        min_history: int = 21,
        threshold: float = 0.5,
        **kwargs: Any,
    ) -> None:
        self._model_path = kwargs.pop("modelPath", model_path)
        self._min_history = max(min_history, 21)
        self._threshold = threshold
        self._bars_by_symbol: defaultdict[str, deque[Bar]] = defaultdict(
            lambda: deque(maxlen=self._min_history)
        )
        self._predictor: Any | None = None

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="ai_predictor",
            description="AI 模型预测择时策略",
            modes=[ResearchMode.AI],
            params=[
                StrategyParamDef(
                    key="model_path",
                    label="模型路径",
                    type=ParamType.String,
                    default=self._model_path,
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
            version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        self._bars_by_symbol.clear()
        predictor_cls = _load_predictor_cls()
        self._predictor = predictor_cls.load(self._model_path)

    def signal(self, bar: Bar, context) -> Signal:
        return self.on_bar(bar, context)

    def on_bar(self, bar: Bar, context) -> Signal:
        bars = self._bars_by_symbol[bar.symbol]
        bars.append(bar)
        if len(bars) < self._min_history:
            return Signal.Hold
        if self._predictor is None:
            raise RuntimeError("AIPredictorStrategy not initialized")

        result = self._predictor.predict(_bars_to_frame(bars))
        if not result.predictions:
            return Signal.Hold

        prediction = result.predictions[-1]
        probability = result.probabilities[-1] if result.probabilities else None
        return _prediction_to_signal(prediction, probability, self._threshold)

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def _load_predictor_cls():
    global AIPredictor
    if AIPredictor is None:
        from quantforge_ai import AIPredictor as _AIPredictor
        AIPredictor = _AIPredictor
    return AIPredictor


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


def _prediction_to_signal(prediction: Any, probability: float | None, threshold: float) -> Signal:
    try:
        value = float(prediction)
    except (TypeError, ValueError):
        return Signal.Hold

    if probability is not None:
        if value > 0:
            return Signal.Buy if probability >= threshold else Signal.Hold
        return Signal.Sell if probability <= 1 - threshold else Signal.Hold

    if value > 0:
        return Signal.Buy
    if value <= 0:
        return Signal.Sell
    return Signal.Hold
