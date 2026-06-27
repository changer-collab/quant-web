"""MultiSymbolRunner 多标的回测测试"""

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy, CompositeStrategy,
    Strategy, StrategyMeta, StrategyResult, Bar, TimeFrame, Signal,
    ResearchMode, StrategyKind, StrategyState, OrderSide, OrderType,
    OrderRequest,
)
from quantforge_backtest import DefaultComposite, MultiSymbolRunner
from quantforge_backtest.market_rules import ASHARE_RULES
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


class BuyOnSecondStep(CompositeStrategy):
    """第二个时间点提交买单，用于验证多标的 runner 在撮合前补涨停价。"""

    def __init__(self) -> None:
        self._step = 0
        self._state = StrategyState.Idle

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_on_second_step", description="第二步买入",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Composite,
        )

    @property
    def state(self) -> StrategyState:
        return self._state

    def init(self, context) -> None:
        self._step = 0
        self._state = StrategyState.Running

    def on_bars(self, bars: dict[str, Bar], context) -> None:
        if self._step == 1 and "600000" in bars:
            context.submit_order(OrderRequest(
                symbol="600000", side=OrderSide.Buy,
                type=OrderType.Market, quantity=100,
            ))
        self._step += 1

    def finish(self) -> StrategyResult:
        self._state = StrategyState.Stopped
        return StrategyResult(meta=self.meta)


class BuyAndSellSameDay(CompositeStrategy):
    """同一时间点同时提交买卖单，用于验证 T+1 锁定。"""

    def __init__(self) -> None:
        self._submitted = False
        self._state = StrategyState.Idle

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_and_sell_same_day", description="同日买入后卖出",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Composite,
        )

    @property
    def state(self) -> StrategyState:
        return self._state

    def init(self, context) -> None:
        self._submitted = False
        self._state = StrategyState.Running

    def on_bars(self, bars: dict[str, Bar], context) -> None:
        if self._submitted or "600000" not in bars:
            return
        context.submit_order(OrderRequest(
            symbol="600000", side=OrderSide.Buy,
            type=OrderType.Market, quantity=100,
        ))
        context.submit_order(OrderRequest(
            symbol="600000", side=OrderSide.Sell,
            type=OrderType.Market, quantity=100,
        ))
        self._submitted = True

    def finish(self) -> StrategyResult:
        self._state = StrategyState.Stopped
        return StrategyResult(meta=self.meta)


class BuyThenSellNextDay(CompositeStrategy):
    """先买入，买入成交后的下一交易日卖出，用于验证 T+1 解锁。"""

    def __init__(self) -> None:
        self._step = 0
        self._state = StrategyState.Idle

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_then_sell_next_day", description="下一交易日卖出",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Composite,
        )

    @property
    def state(self) -> StrategyState:
        return self._state

    def init(self, context) -> None:
        self._step = 0
        self._state = StrategyState.Running

    def on_bars(self, bars: dict[str, Bar], context) -> None:
        if "600000" not in bars:
            return
        if self._step == 0:
            context.submit_order(OrderRequest(
                symbol="600000", side=OrderSide.Buy,
                type=OrderType.Market, quantity=100,
            ))
        elif self._step == 1:
            context.submit_order(OrderRequest(
                symbol="600000", side=OrderSide.Sell,
                type=OrderType.Market, quantity=100,
            ))
        self._step += 1

    def finish(self) -> StrategyResult:
        self._state = StrategyState.Stopped
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


def test_multi_runner_enforces_t_plus_1_with_market_rules():
    strategy = BuyAndSellSameDay()
    bars = {"600000": _make_bars("600000", 2, 10.0)}

    runner = MultiSymbolRunner(
        strategy=strategy,
        bars=bars,
        initial_cash=100000,
        market_rules=ASHARE_RULES,
    )
    result = runner.run()

    assert [trade.side for trade in result.trades] == [OrderSide.Buy]
    assert result.config.enable_market_rules is True


def test_multi_runner_unlocks_t_plus_1_on_next_trading_day():
    strategy = BuyThenSellNextDay()
    bars = {"600000": _make_bars("600000", 4, 10.0)}

    runner = MultiSymbolRunner(
        strategy=strategy,
        bars=bars,
        initial_cash=100000,
        market_rules=ASHARE_RULES,
    )
    result = runner.run()

    assert [trade.side for trade in result.trades] == [OrderSide.Buy, OrderSide.Sell]


def test_multi_runner_applies_limit_prices_before_matching_pending_order():
    bars = {
        "600000": [
            Bar(
                symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
                open=10.0, high=10.1, low=9.9, close=10.0, volume=1000,
            ),
            Bar(
                symbol="600000", timeframe=TimeFrame.D1, timestamp=1,
                open=10.0, high=10.1, low=9.9, close=10.0, volume=1000,
            ),
            Bar(
                symbol="600000", timeframe=TimeFrame.D1, timestamp=2,
                open=11.0, high=11.0, low=10.9, close=11.0, volume=1000,
            ),
        ],
    }

    runner = MultiSymbolRunner(
        strategy=BuyOnSecondStep(),
        bars=bars,
        initial_cash=100000,
        market_rules=ASHARE_RULES,
    )
    result = runner.run()

    assert result.trades == []


def test_multi_runner_sub_equity_present():
    """多标的回测结果包含 sub_equity 字段，且每个 symbol 都有权益曲线。"""
    selector = BuyAllSelector()
    timer = FirstBarBuyTimer()
    sizer = SmallQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    bars = {
        "600000": _make_bars("600000", 3, 10.0),
        "600001": _make_bars("600001", 3, 20.0),
    }

    runner = MultiSymbolRunner(
        strategy=composite, bars=bars, initial_cash=100000,
    )
    result = runner.run()

    assert result.sub_equity is not None
    assert "600000" in result.sub_equity
    assert "600001" in result.sub_equity
    # 每个 symbol 应有 3 个时间点
    assert len(result.sub_equity["600000"]) == 3
    assert len(result.sub_equity["600001"]) == 3


def test_single_symbol_backtest_no_sub_equity():
    """单标的回测结果 sub_equity 为 None（BacktestRunner 不产生 sub_equity）。"""
    from quantforge_backtest import BacktestRunner

    class SimpleStrategy(Strategy):
        def __init__(self):
            self._state = StrategyState.Idle

        @property
        def meta(self) -> StrategyMeta:
            return StrategyMeta(
                name="simple", description="simple",
                modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            )

        @property
        def state(self) -> StrategyState:
            return self._state

        def init(self, context):
            pass

        def on_bar(self, bar, context):
            pass

        def finish(self):
            return StrategyResult(meta=self.meta)

    bars = _make_bars("600000", 3, 10.0)
    runner = BacktestRunner(strategy=SimpleStrategy(), bars=bars)
    result = runner.run()

    assert result.sub_equity is None
