"""RSI 策略测试"""

from quantforge_strategies.combined.rsi import RSIStrategy


def test_meta():
    s = RSIStrategy()
    assert s.meta.name == "rsi"
    assert len(s.meta.params) == 3


def test_init():
    s = RSIStrategy(period=14)
    s.init(None)  # type: ignore
    assert s._bought is False
