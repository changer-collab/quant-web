"""指标计算测试"""

from quantforge_backtest.metrics import calc_metrics, calc_trade_stats
from quantforge_backtest.types import EquityPoint
from quantforge_strategy import OrderSide


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


def test_sortino_ratio_positive():
    """有下行波动的曲线 → sortino_ratio > 0（有负收益但整体向上）"""
    # 先升后降再升：保证有负日收益率，同时总体为正
    equities = [100000.0]
    for i in range(1, 60):
        prev = equities[-1]
        # 奇数天微跌，偶数天涨更多
        if i % 3 == 1:
            equities.append(prev * 0.995)  # -0.5%
        else:
            equities.append(prev * 1.008)  # +0.8%
    curve = [EquityPoint(timestamp=i, equity=e) for i, e in enumerate(equities)]
    m = calc_metrics(curve, 100000)
    # 应该有负收益（奇数天下跌），所以 down_dev > 0
    assert m.sortino_ratio > 0


def test_calmar_ratio_positive():
    """有回撤的曲线 → calmar_ratio > 0"""
    curve = [
        EquityPoint(timestamp=0, equity=100000),
        EquityPoint(timestamp=1, equity=110000),
        EquityPoint(timestamp=2, equity=105000),
        EquityPoint(timestamp=3, equity=103000),
        EquityPoint(timestamp=4, equity=115000),
    ]
    m = calc_metrics(curve, 100000)
    # calmar = annualized_return / max_drawdown
    assert m.max_drawdown > 0
    assert m.calmar_ratio > 0


def test_annualized_volatility_positive():
    """有波动的曲线 → annualized_volatility > 0"""
    curve = [
        EquityPoint(timestamp=i, equity=100000 + (i % 3 - 1) * 500)
        for i in range(100)
    ]
    m = calc_metrics(curve, 100000)
    assert m.annualized_volatility > 0


def test_max_drawdown_duration():
    """回撤期间 duration 应 > 0"""
    curve = [
        EquityPoint(timestamp=0, equity=100000),
        EquityPoint(timestamp=1, equity=110000),
        EquityPoint(timestamp=2, equity=105000),
        EquityPoint(timestamp=3, equity=103000),
        EquityPoint(timestamp=4, equity=108000),  # still below 110000
        EquityPoint(timestamp=5, equity=115000),  # new high
    ]
    m = calc_metrics(curve, 100000)
    assert m.max_drawdown_duration >= 3  # from index 1 to index 4


def test_empty_trades():
    stats = calc_trade_stats([])
    assert stats["profit_loss_ratio"] == 0.0
    assert stats["avg_holding_days"] == 0.0


def test_trade_stats_with_trades():
    """FIFO 匹配买卖交易，计算盈亏和持仓天数"""
    from quantforge_backtest.types import EquityPoint

    class FakeTrade:
        def __init__(self, side, price, quantity, timestamp, symbol="600000"):
            self.side = side
            self.price = price
            self.quantity = quantity
            self.timestamp = timestamp
            self.symbol = symbol

    # 使用秒级时间戳（10位），不是毫秒级
    trades = [
        FakeTrade(OrderSide.Buy, 10.0, 100, 1000000000),           # t=0
        FakeTrade(OrderSide.Sell, 12.0, 100, 1000086400),          # +1 day (86400s), profit=200
        FakeTrade(OrderSide.Buy, 11.0, 100, 1000086400),
        FakeTrade(OrderSide.Sell, 10.0, 100, 1000172800),          # +1 day, profit=-100
    ]
    stats = calc_trade_stats(trades)
    # profit_loss_ratio = avg_gain / avg_loss = 200 / 100 = 2.0
    assert stats["profit_loss_ratio"] == 2.0
    assert stats["avg_holding_days"] == 1.0
    assert stats["max_single_profit"] == 200.0
    assert stats["max_single_loss"] == -100.0
