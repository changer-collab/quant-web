"""KDJ 策略测试"""

from quantforge_strategies import get, list_all, KDJStrategy
from quantforge_strategies.combined.kdj import KDJStrategy as KDJStrategyDirect


def test_meta():
    s = KDJStrategy()
    assert s.meta.name == "kdj"
    assert len(s.meta.params) == 3
    assert s.meta.version
    assert s.meta.kind.value == "combined"


def test_init():
    s = KDJStrategy(period=9, oversold=20.0, overbought=80.0)
    s.init(None)  # type: ignore
    assert s._bought is False
    assert s._k == 50.0
    assert s._d == 50.0
    assert s._prev_k is None
    assert s._prev_d is None


def test_registered():
    cls = get("kdj")
    assert cls is KDJStrategyDirect
    all_strategies = list_all()
    assert "kdj" in all_strategies


def test_insufficient_history_no_trade():
    """数据不足时不应下单"""
    s = KDJStrategy(period=9)
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
    # 只喂 5 根 bar（不足 period=9）
    for i in range(5):
        bar = type("Bar", (), {
            "symbol": "TEST", "close": 100.0 + i,
            "open": 100.0, "high": 101.0, "low": 99.0,
            "volume": 1000.0, "timestamp": i, "timeframe": None,
        })()
        s.on_bar(bar, ctx)
    assert len(ctx.submitted) == 0
