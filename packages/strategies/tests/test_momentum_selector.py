"""动量选股策略测试"""

from quantforge_strategies.selectors.momentum import MomentumSelector
from quantforge_strategy import Bar, TimeFrame, StrategyKind


def _make_bar(symbol: str, close: float, ts: int) -> Bar:
    return Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=ts,
               open=close, high=close, low=close, close=close, volume=1000)


def test_meta():
    s = MomentumSelector(lookback=5, top_k=3)
    assert s.meta.name == "momentum_selector"
    assert s.meta.kind == StrategyKind.Select
    assert len(s.meta.params) == 2


def test_init():
    s = MomentumSelector(lookback=10, top_k=2)
    s.init(None)
    assert s._lookback == 10
    assert s._top_k == 2


def test_select_insufficient_history():
    """历史不足时返回空列表"""
    s = MomentumSelector(lookback=5, top_k=3)
    s.init(None)

    bars = {"600000": _make_bar("600000", 10.0, 0)}
    result = s.select(bars, None)
    assert result == []


def test_select_top_k():
    """选出动量最高的 top_k 只股票"""
    s = MomentumSelector(lookback=3, top_k=2)
    s.init(None)

    # 构造 3 只股票，各 3 根 bar
    # 600000: 10 -> 12 -> 15  (涨幅 50%)
    # 600001: 20 -> 21 -> 22  (涨幅 10%)
    # 600002: 30 -> 28 -> 25  (跌幅 -17%)
    for ts in range(3):
        bars = {
            "600000": _make_bar("600000", [10, 12, 15][ts], ts),
            "600001": _make_bar("600001", [20, 21, 22][ts], ts),
            "600002": _make_bar("600002", [30, 28, 25][ts], ts),
        }
        result = s.select(bars, None)

    # 动量排名: 600000 (50%) > 600001 (10%) > 600002 (-17%)
    # top_k=2 → 600000, 600001
    assert result == ["600000", "600001"]


def test_select_fewer_than_top_k():
    """候选股票少于 top_k 时返回全部"""
    s = MomentumSelector(lookback=2, top_k=5)
    s.init(None)

    for ts in range(2):
        bars = {
            "600000": _make_bar("600000", 10 + ts, ts),
        }
        result = s.select(bars, None)

    assert result == ["600000"]
