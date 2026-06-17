"""双均线策略测试"""

from quantforge_strategies.combined.dual_ma import DualMAStrategy


def test_meta():
    s = DualMAStrategy()
    assert s.meta.name == "dual_ma"
    assert len(s.meta.params) == 2


def test_init():
    s = DualMAStrategy(short_period=3, long_period=5)
    s.init(None)  # type: ignore
    assert s._bought is False
