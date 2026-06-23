"""equity_stats 模块测试"""

from quantforge_backtest import EquityPoint
from quantforge_backtest.equity_stats import (
    compute_drawdown_curve,
    compute_period_returns,
)


def test_drawdown_curve_basic():
    """回撤序列：峰值后下跌为负值，新高归零"""
    curve = [
        EquityPoint(timestamp=1_000_000_000, equity=100),
        EquityPoint(timestamp=1_000_086_400, equity=110),
        EquityPoint(timestamp=1_000_172_800, equity=90),
        EquityPoint(timestamp=1_000_259_200, equity=95),
    ]
    dd = compute_drawdown_curve(curve)
    assert len(dd) == 4
    assert dd[0].drawdown == 0.0
    assert dd[1].drawdown == 0.0  # 新高
    assert dd[2].drawdown < 0     # 90/110 - 1 ≈ -0.1818
    assert abs(dd[2].drawdown - (-0.181818)) < 0.001
    assert dd[3].drawdown < 0     # 95/110 - 1 ≈ -0.1364


def test_drawdown_curve_empty():
    assert compute_drawdown_curve([]) == []


def test_period_returns_empty():
    monthly, annual = compute_period_returns([])
    assert monthly == []
    assert annual == []


def test_period_returns_single_point():
    curve = [EquityPoint(timestamp=1_000_000_000, equity=100)]
    monthly, annual = compute_period_returns(curve)
    assert monthly == []
    assert annual == []


def test_period_returns_monthly():
    """同月内取末尾权益，跨月计算收益率"""
    import time
    ts_jan = int(time.mktime((2023, 1, 15, 0, 0, 0, 0, 0, 0)))
    ts_feb = int(time.mktime((2023, 2, 15, 0, 0, 0, 0, 0, 0)))
    curve = [
        EquityPoint(timestamp=ts_jan, equity=100),
        EquityPoint(timestamp=ts_feb, equity=105),
    ]
    monthly, annual = compute_period_returns(curve)
    assert len(monthly) == 1
    assert monthly[0].year == 2023
    assert monthly[0].month == 2
    assert abs(monthly[0].return_pct - 5.0) < 0.01  # (105-100)/100*100 = 5%
