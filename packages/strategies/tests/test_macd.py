"""MACD 策略测试"""

from quantforge_strategies import get, list_all, MACDStrategy
from quantforge_strategies.combined.macd import MACDStrategy as MACDStrategyDirect


def test_meta():
    s = MACDStrategy()
    assert s.meta.name == "macd"
    assert len(s.meta.params) == 3
    assert s.meta.version
    assert s.meta.kind.value == "timing"


def test_init():
    s = MACDStrategy(fast_period=5, slow_period=10, signal_period=3)
    s.init(None)  # type: ignore
    assert s._bought is False
    assert len(s._prices) == 0


def test_registered():
    cls = get("macd")
    assert cls is MACDStrategyDirect
    all_strategies = list_all()
    assert "macd" in all_strategies


def test_insufficient_history_no_trade():
    """数据不足时不应下单"""
    s = MACDStrategy(fast_period=5, slow_period=10, signal_period=3)
    s.init(None)  # type: ignore

    class _FakeAccount:
        cash = 1_000_000

    class _FakeContext:
        submitted = []

        def submit_order(self, req):
            self.submitted.append(req)

        def get_account(self):
            return _FakeAccount()

        def get_position(self, symbol):
            return None

    ctx = _FakeContext()
    # 只喂 5 根 bar（不足 slow_period=10）
    for i in range(5):
        bar = type("Bar", (), {
            "symbol": "TEST", "close": 100.0 + i,
            "open": 100.0, "high": 101.0, "low": 99.0,
            "volume": 1000.0, "timestamp": i, "timeframe": None,
        })()
        s.on_bar(bar, ctx)
    assert len(ctx.submitted) == 0
