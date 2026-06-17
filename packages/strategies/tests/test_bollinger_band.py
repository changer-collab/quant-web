"""布林带策略测试"""

from quantforge_strategies import get, list_all, BollingerBandStrategy


def test_meta():
    s = BollingerBandStrategy()
    assert s.meta.name == "bollinger_band"
    assert len(s.meta.params) == 2


def test_init():
    s = BollingerBandStrategy(period=10, num_std=1.5)
    assert s._period == 10
    assert s._num_std == 1.5


def test_registered():
    cls = get("bollinger_band")
    assert cls is BollingerBandStrategy
    all_strategies = list_all()
    assert "bollinger_band" in all_strategies
