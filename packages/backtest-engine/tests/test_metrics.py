"""指标计算测试"""

from quantforge_backtest.metrics import calc_metrics
from quantforge_backtest.types import EquityPoint


def test_empty_curve():
    m = calc_metrics([], 100000)
    assert m.total_trades == 0


def test_single_point():
    m = calc_metrics([EquityPoint(timestamp=0, equity=100000)], 100000)
    assert m.total_trades == 0


def test_profit_curve():
    curve = [
        EquityPoint(timestamp=0, equity=100000),
        EquityPoint(timestamp=1, equity=110000),
        EquityPoint(timestamp=2, equity=120000),
    ]
    m = calc_metrics(curve, 100000, total_trades=5)
    assert m.total_return == 0.2
    assert m.total_trades == 5
    assert m.max_drawdown == 0.0
    assert m.win_rate == 1.0


def test_drawdown():
    curve = [
        EquityPoint(timestamp=0, equity=100000),
        EquityPoint(timestamp=1, equity=110000),
        EquityPoint(timestamp=2, equity=99000),  # drawdown from 110000
        EquityPoint(timestamp=3, equity=105000),
    ]
    m = calc_metrics(curve, 100000)
    assert m.max_drawdown > 0
    # max drawdown = (110000 - 99000) / 110000 ≈ 0.1
    assert round(m.max_drawdown, 2) == 0.1
