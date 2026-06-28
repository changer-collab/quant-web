"""AI 预测择时策略测试"""

from quantforge_strategy import Bar, Signal, StrategyKind, TimeFrame
from quantforge_strategies import get
from quantforge_strategies.combined.ai_predictor import AIPredictorStrategy


class _FakePredictor:
    load_path = None
    predict_calls = 0
    predictions = [1]
    probabilities = [0.9]
    frames = []

    @classmethod
    def reset(cls):
        cls.load_path = None
        cls.predict_calls = 0
        cls.predictions = [1]
        cls.probabilities = [0.9]
        cls.frames = []

    @classmethod
    def load(cls, path):
        cls.load_path = path
        return cls()

    def predict(self, df):
        cls = type(self)
        cls.predict_calls += 1
        cls.frames.append(df.copy())

        class _Result:
            predictions = list(cls.predictions)
            probabilities = list(cls.probabilities)

        return _Result()


def _bar(close: float, ts: int, symbol: str = "TEST") -> Bar:
    return Bar(
        symbol=symbol,
        timeframe=TimeFrame.D1,
        timestamp=ts,
        open=close,
        high=close,
        low=close,
        close=close,
        volume=1000.0 + ts,
    )


def _install_fake(monkeypatch):
    _FakePredictor.reset()
    monkeypatch.setattr("quantforge_strategies.combined.ai_predictor.AIPredictor", _FakePredictor)


def _feed(strategy: AIPredictorStrategy, count: int, symbol: str = "TEST") -> Signal:
    signal = Signal.Hold
    for i in range(count):
        signal = strategy.signal(_bar(100.0 + i, i, symbol), None)
    return signal


def test_meta_and_registry():
    strategy = AIPredictorStrategy(model_path="data/models/demo.joblib")

    assert strategy.meta.name == "ai_predictor"
    assert strategy.meta.kind == StrategyKind.Timing
    assert strategy.meta.params[1].min == 21
    assert get("ai_predictor") is AIPredictorStrategy


def test_init_loads_model_and_accepts_camel_case_model_path(monkeypatch):
    _install_fake(monkeypatch)
    strategy = AIPredictorStrategy(modelPath="data/models/demo.joblib")

    strategy.init(None)

    assert _FakePredictor.load_path == "data/models/demo.joblib"


def test_signal_holds_until_feature_window_is_ready(monkeypatch):
    _install_fake(monkeypatch)
    strategy = AIPredictorStrategy(model_path="data/models/demo.joblib", min_history=1)
    strategy.init(None)

    assert _feed(strategy, 20) == Signal.Hold
    assert _FakePredictor.predict_calls == 0

    signal = strategy.signal(_bar(120.0, 20), None)

    assert signal == Signal.Buy
    assert _FakePredictor.predict_calls == 1


def test_signal_calls_predict_and_maps_positive_to_buy(monkeypatch):
    _install_fake(monkeypatch)
    _FakePredictor.predictions = [1]
    _FakePredictor.probabilities = [0.9]
    strategy = AIPredictorStrategy(model_path="data/models/demo.joblib")
    strategy.init(None)

    signal = _feed(strategy, 21)

    assert signal == Signal.Buy
    assert _FakePredictor.predict_calls == 1


def test_signal_maps_negative_to_sell(monkeypatch):
    _install_fake(monkeypatch)
    _FakePredictor.predictions = [0]
    _FakePredictor.probabilities = [0.2]
    strategy = AIPredictorStrategy(model_path="data/models/demo.joblib")
    strategy.init(None)

    assert _feed(strategy, 21) == Signal.Sell


def test_signal_holds_when_probability_below_threshold(monkeypatch):
    _install_fake(monkeypatch)
    _FakePredictor.predictions = [1]
    _FakePredictor.probabilities = [0.51]
    strategy = AIPredictorStrategy(model_path="data/models/demo.joblib", threshold=0.6)
    strategy.init(None)

    assert _feed(strategy, 21) == Signal.Hold


def test_symbol_histories_are_not_mixed_in_composite_timer(monkeypatch):
    _install_fake(monkeypatch)
    strategy = AIPredictorStrategy(model_path="data/models/demo.joblib")
    strategy.init(None)

    for i in range(20):
        assert strategy.signal(_bar(100.0 + i, i, "AAA"), None) == Signal.Hold
        assert strategy.signal(_bar(200.0 + i, i, "BBB"), None) == Signal.Hold
    assert _FakePredictor.predict_calls == 0

    assert strategy.signal(_bar(121.0, 21, "AAA"), None) == Signal.Buy
    assert strategy.signal(_bar(221.0, 21, "BBB"), None) == Signal.Buy

    assert _FakePredictor.predict_calls == 2
    assert set(_FakePredictor.frames[0]["symbol"]) == {"AAA"}
    assert set(_FakePredictor.frames[1]["symbol"]) == {"BBB"}
