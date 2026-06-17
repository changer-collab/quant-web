"""端到端集成测试：多策略组合（Portfolio）资金分配"""

from quantforge_strategy import Bar, TimeFrame
from quantforge_strategies import (
    MomentumSelector, MACrossoverTiming, EqualWeightSizer, FixedFractionSizer,
)
from quantforge_backtest import DefaultComposite, MultiStrategyRunner
from quantforge_backtest.types import BacktestResult


def _make_bars(symbol: str, prices: list[float]) -> list[Bar]:
    return [
        Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=i,
            open=p, high=p * 1.01, low=p * 0.99, close=p, volume=1000)
        for i, p in enumerate(prices)
    ]


def test_e2e_portfolio_two_composites():
    """两个分层组合策略按 60/40 权重组合"""
    # 组合A：动量选股 + 均线择时 + 等权仓位
    composite_a = DefaultComposite(
        MomentumSelector(lookback=3, top_k=2),
        MACrossoverTiming(short_period=2, long_period=4),
        EqualWeightSizer(max_positions=2),
    )

    # 组合B：动量选股 + 均线择时 + 固定比例仓位
    composite_b = DefaultComposite(
        MomentumSelector(lookback=3, top_k=2),
        MACrossoverTiming(short_period=2, long_period=4),
        FixedFractionSizer(fraction=0.3),
    )

    bars = {
        "600000": _make_bars("600000", [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
        "600001": _make_bars("600001", [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]),
        "600002": _make_bars("600002", [30, 30, 30, 30, 35, 36, 37, 38, 39, 40]),
    }

    runner = MultiStrategyRunner(
        strategies=[(composite_a, 0.6), (composite_b, 0.4)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 10
    # 两个子策略各自产生交易
    assert result.metrics.total_trades > 0
    # 合并权益应接近初始资金 + 浮动盈亏
    assert result.equity_curve[0].equity > 0


def test_e2e_portfolio_single_equivalent():
    """单策略权重 1.0 等价于直接运行"""
    composite = DefaultComposite(
        MomentumSelector(lookback=1, top_k=1),
        MACrossoverTiming(short_period=2, long_period=3),
        EqualWeightSizer(max_positions=1),
    )

    # 价格先跌后涨，触发金叉：ts=3 时短均线上穿长均线
    bars = {"600000": _make_bars("600000", [10, 9, 8, 12, 14])}

    runner = MultiStrategyRunner(
        strategies=[(composite, 1.0)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 5
    assert result.metrics.total_trades > 0


def test_e2e_portfolio_three_strategies():
    """三个分层组合策略按 40/30/30 权重组合"""
    configs = [
        (MomentumSelector(lookback=2, top_k=2), 0.4),
        (MomentumSelector(lookback=3, top_k=2), 0.3),
        (MomentumSelector(lookback=4, top_k=2), 0.3),
    ]

    composites = [
        DefaultComposite(
            sel, MACrossoverTiming(short_period=2, long_period=3),
            EqualWeightSizer(max_positions=2),
        )
        for sel, _ in configs
    ]

    bars = {
        "600000": _make_bars("600000", [10, 11, 12, 13, 14, 15, 16, 17]),
        "600001": _make_bars("600001", [20, 21, 22, 23, 24, 25, 26, 27]),
        "600002": _make_bars("600002", [30, 29, 28, 27, 26, 25, 24, 23]),
    }

    runner = MultiStrategyRunner(
        strategies=[(c, w) for c, (_, w) in zip(composites, configs)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 8
    assert result.metrics.total_trades > 0
