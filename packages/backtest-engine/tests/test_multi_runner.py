"""MultiSymbolRunner 多标的回测测试"""

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy,
    StrategyMeta, StrategyResult, Bar, TimeFrame, Signal,
    ResearchMode, StrategyKind,
)
from quantforge_backtest import DefaultComposite, MultiSymbolRunner
from quantforge_backtest.types import BacktestResult


class BuyAllSelector(SelectorStrategy):
    """选所有有行情的股票"""

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
    """第一根 bar 买入，之后 Hold"""

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
    """买入返回 10，卖出返回 0"""

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


def test_multi_runner_basic():
    selector = BuyAllSelector()
    timer = FirstBarBuyTimer()
    sizer = SmallQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    bars = {
        "600000": _make_bars("600000", 5, 10.0),
        "600001": _make_bars("600001", 5, 20.0),
    }

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert result.metrics.total_trades == 2  # 两只股票各买一次
    assert len(result.equity_curve) == 5


def test_multi_runner_empty_bars():
    selector = BuyAllSelector()
    timer = FirstBarBuyTimer()
    sizer = SmallQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    runner = MultiSymbolRunner(
        strategy=composite, bars={}, initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 0
    assert len(result.equity_curve) == 0


def test_multi_runner_single_symbol():
    selector = BuyAllSelector()
    timer = FirstBarBuyTimer()
    sizer = SmallQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    bars = {"600000": _make_bars("600000", 3, 10.0)}

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert result.metrics.total_trades == 1
    assert len(result.equity_curve) == 3
