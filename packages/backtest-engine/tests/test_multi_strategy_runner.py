"""MultiStrategyRunner 多策略组合测试"""

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy,
    StrategyMeta, StrategyResult, Bar, TimeFrame, Signal,
    ResearchMode, StrategyKind,
)
from quantforge_backtest import DefaultComposite, MultiSymbolRunner, MultiStrategyRunner
from quantforge_backtest.types import BacktestResult


class BuyAllSelector(SelectorStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_all", description="全选",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        pass

    def select(self, bars: dict, context) -> list:
        return list(bars.keys())

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class FirstBarBuyTimer(TimingStrategy):
    def __init__(self):
        self._bought: set[str] = set()

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="first_buy", description="首日买入",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        self._bought.clear()

    def signal(self, bar: Bar, context) -> Signal:
        if bar.symbol not in self._bought:
            self._bought.add(bar.symbol)
            return Signal.Buy
        return Signal.Hold

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class SmallQtySizer(PositionStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="small_qty", description="小数量",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Buy:
            return 10.0
        return 0.0

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def _make_bars(symbol: str, n: int, start_price: float = 10.0) -> list[Bar]:
    return [
        Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=i,
            open=start_price + i * 0.1,
            high=start_price + i * 0.1 + 0.05,
            low=start_price + i * 0.1 - 0.05,
            close=start_price + i * 0.1,
            volume=1000)
        for i in range(n)
    ]


def _make_composite(name: str) -> DefaultComposite:
    return DefaultComposite(BuyAllSelector(), FirstBarBuyTimer(), SmallQtySizer())


def test_multi_strategy_runner_basic():
    """两个子策略按权重分配资金"""
    strategy_a = _make_composite("a")
    strategy_b = _make_composite("b")

    bars = {
        "600000": _make_bars("600000", 5, 10.0),
        "600001": _make_bars("600001", 5, 20.0),
    }

    runner = MultiStrategyRunner(
        strategies=[(strategy_a, 0.6), (strategy_b, 0.4)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    # 两个子策略各买 2 只股票 = 4 笔交易
    assert result.metrics.total_trades == 4
    assert len(result.equity_curve) == 5


def test_multi_strategy_runner_single():
    """单个子策略等价于直接运行"""
    strategy = _make_composite("only")

    bars = {"600000": _make_bars("600000", 3, 10.0)}

    runner = MultiStrategyRunner(
        strategies=[(strategy, 1.0)],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 1
    assert len(result.equity_curve) == 3


def test_multi_strategy_runner_empty():
    """空策略列表"""
    bars = {"600000": _make_bars("600000", 3, 10.0)}

    runner = MultiStrategyRunner(
        strategies=[],
        bars=bars,
        initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 0
    assert len(result.equity_curve) == 0
