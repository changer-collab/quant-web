"""均线交叉择时策略测试"""

from quantforge_strategies.timers.ma_crossover import MACrossoverTiming
from quantforge_strategy import Bar, TimeFrame, Signal, StrategyKind


def _make_bar(close: float, ts: int) -> Bar:
    return Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=ts,
               open=close, high=close, low=close, close=close, volume=1000)


def test_meta():
    t = MACrossoverTiming(short_period=5, long_period=20)
    assert t.meta.name == "ma_crossover"
    assert t.meta.kind == StrategyKind.Timing
    assert len(t.meta.params) == 2


def test_init():
    t = MACrossoverTiming(short_period=3, long_period=5)
    t.init(None)
    assert t._short_period == 3
    assert t._long_period == 5


def test_hold_when_insufficient_data():
    """数据不足时返回 Hold"""
    t = MACrossoverTiming(short_period=3, long_period=5)
    t.init(None)

    bar = _make_bar(10.0, 0)
    assert t.signal(bar, None) == Signal.Hold


def test_buy_on_golden_cross():
    """金叉买入"""
    t = MACrossoverTiming(short_period=2, long_period=4)
    t.init(None)

    # 价格序列: 10, 10, 10, 10, 15（第 5 根时短均线上穿长均线）
    prices = [10.0, 10.0, 10.0, 10.0, 15.0]
    result = None
    for i, p in enumerate(prices):
        result = t.signal(_make_bar(p, i), None)

    assert result == Signal.Buy


def test_hold_when_no_cross():
    """无新交叉时 Hold"""
    t = MACrossoverTiming(short_period=2, long_period=4)
    t.init(None)

    # 持续上涨，第一次金叉后无新交叉
    prices = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0]
    last_signal = None
    for i, p in enumerate(prices):
        last_signal = t.signal(_make_bar(p, i), None)

    # 第一次满足条件时是 Buy（金叉），之后持续 Hold
    assert last_signal == Signal.Hold
