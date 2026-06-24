"""equity_stats 模块测试"""

import time

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


def test_period_returns_annual():
    """跨年度计算年度收益率"""
    ts_2023 = int(time.mktime((2023, 6, 15, 0, 0, 0, 0, 0, 0)))
    ts_2024 = int(time.mktime((2024, 6, 15, 0, 0, 0, 0, 0, 0)))
    curve = [
        EquityPoint(timestamp=ts_2023, equity=100),
        EquityPoint(timestamp=ts_2024, equity=120),
    ]
    monthly, annual = compute_period_returns(curve)
    assert len(annual) == 1
    assert annual[0].year == 2024
    assert abs(annual[0].return_pct - 20.0) < 0.01  # (120-100)/100*100 = 20%


def test_period_returns_same_month_multiple_points():
    """同月多个数据点取末尾权益"""
    ts1 = int(time.mktime((2023, 1, 10, 0, 0, 0, 0, 0, 0)))
    ts2 = int(time.mktime((2023, 1, 20, 0, 0, 0, 0, 0, 0)))
    ts3 = int(time.mktime((2023, 2, 15, 0, 0, 0, 0, 0, 0)))
    curve = [
        EquityPoint(timestamp=ts1, equity=100),
        EquityPoint(timestamp=ts2, equity=108),  # 1月末尾权益
        EquityPoint(timestamp=ts3, equity=105),
    ]
    monthly, annual = compute_period_returns(curve)
    assert len(monthly) == 1
    assert monthly[0].month == 2
    # (105 - 108) / 108 * 100 ≈ -2.778
    assert abs(monthly[0].return_pct - (-2.7778)) < 0.01
