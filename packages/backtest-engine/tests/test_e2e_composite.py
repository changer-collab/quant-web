"""端到端集成测试：选股 + 择时 + 仓位管理 → 多标的回测"""

from quantforge_strategy import Bar, TimeFrame, Signal, StrategyKind
from quantforge_strategies import (
    MomentumSelector, MACrossoverTiming, EqualWeightSizer,
)
from quantforge_backtest import DefaultComposite, MultiSymbolRunner
from quantforge_backtest.types import BacktestResult


def _make_bars(symbol: str, prices: list[float]) -> list[Bar]:
    return [
        Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=i,
            open=p, high=p * 1.01, low=p * 0.99, close=p, volume=1000)
        for i, p in enumerate(prices)
    ]


def test_e2e_momentum_ma_crossover_equal_weight():
    """动量选股 + 均线交叉择时 + 等权仓位 → 完整回测"""
    selector = MomentumSelector(lookback=3, top_k=2)
    timer = MACrossoverTiming(short_period=2, long_period=4)
    sizer = EqualWeightSizer(max_positions=2)
    composite = DefaultComposite(selector, timer, sizer)

    # 3 只股票，各 10 根 bar
    bars = {
        "600000": _make_bars("600000", [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]),
        "600001": _make_bars("600001", [20, 19, 18, 17, 16, 15, 14, 13, 12, 11]),
        "600002": _make_bars("600002", [30, 30, 30, 30, 35, 36, 37, 38, 39, 40]),
    }

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 10
    # 应有交易产生
    assert result.metrics.total_trades > 0


def test_e2e_single_symbol_composite():
    """单标的组合策略回测"""
    selector = MomentumSelector(lookback=2, top_k=1)
    timer = MACrossoverTiming(short_period=2, long_period=3)
    sizer = EqualWeightSizer(max_positions=1)
    composite = DefaultComposite(selector, timer, sizer)

    bars = {
        "600000": _make_bars("600000", [10, 10, 10, 15, 16, 17, 18, 19]),
    }

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert len(result.equity_curve) == 8
