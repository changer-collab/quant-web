"""DefaultComposite 组合策略实现测试"""

from quantforge_strategy import (
    SelectorStrategy, TimingStrategy, PositionStrategy,
    StrategyMeta, StrategyResult, StrategyState,
    Bar, TimeFrame, Signal, OrderSide, OrderType, OrderRequest,
    ResearchMode, StrategyKind,
)
from quantforge_strategy.portfolio import Account, Position
from quantforge_backtest.composite_impl import DefaultComposite


class FixedSelector(SelectorStrategy):
    """固定选股：总是返回预设股票池"""

    def __init__(self, symbols: list[str]):
        self._symbols = symbols

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="fixed_selector", description="固定选股",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        pass

    def select(self, bars: dict, context) -> list:
        return [s for s in self._symbols if s in bars]

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class AlwaysBuyTimer(TimingStrategy):
    """总是输出 Buy 信号"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="always_buy", description="总是买入",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        pass

    def signal(self, bar: Bar, context) -> Signal:
        return Signal.Buy

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class FixedQtySizer(PositionStrategy):
    """固定数量：买入返回 100，卖出返回 0"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="fixed_qty", description="固定数量",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        if signal == Signal.Buy:
            return 100.0
        return 0.0  # 卖出时清仓

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class FakeContext:
    """模拟上下文，记录提交的订单"""

    def __init__(self, cash: float = 100000.0):
        self._account = Account(initial_cash=cash, cash=cash, equity=cash)
        self._positions: dict[str, Position] = {}
        self.submitted_orders: list[OrderRequest] = []

    def submit_order(self, request: OrderRequest) -> None:
        self.submitted_orders.append(request)

    def get_position(self, symbol: str):
        return self._positions.get(symbol)

    def get_all_positions(self):
        return list(self._positions.values())

    def get_account(self):
        return self._account

    def log(self, level: str, message: str, data: object = None) -> None:
        pass


def _make_bar(symbol: str, close: float = 10.0, ts: int = 0) -> Bar:
    return Bar(symbol=symbol, timeframe=TimeFrame.D1, timestamp=ts,
               open=close, high=close * 1.01, low=close * 0.99,
               close=close, volume=1000)


def test_default_composite_meta():
    selector = FixedSelector(["600000"])
    timer = AlwaysBuyTimer()
    sizer = FixedQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    assert composite.meta.kind == StrategyKind.Composite
    assert "fixed_selector" in composite.meta.name


def test_default_composite_buy_signal():
    selector = FixedSelector(["600000"])
    timer = AlwaysBuyTimer()
    sizer = FixedQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    ctx = FakeContext(cash=100000)
    composite.init(ctx)

    bar = _make_bar("600000", close=10.0)
    composite.on_bars({"600000": bar}, ctx)

    # 应提交一个买单，数量 100
    assert len(ctx.submitted_orders) == 1
    order = ctx.submitted_orders[0]
    assert order.side == OrderSide.Buy
    assert order.quantity == 100
    assert order.symbol == "600000"


def test_default_composite_hold_no_order():
    """Hold 信号不应下单"""

    class HoldTimer(TimingStrategy):
        @property
        def meta(self) -> StrategyMeta:
            return StrategyMeta(
                name="hold", description="持有",
                modes=[ResearchMode.Traditional], params=[], version="0.1.0",
                kind=StrategyKind.Timing,
            )

        def init(self, context) -> None:
            pass

        def signal(self, bar: Bar, context) -> Signal:
            return Signal.Hold

        def finish(self) -> StrategyResult:
            return StrategyResult(meta=self.meta)

    selector = FixedSelector(["600000"])
    timer = HoldTimer()
    sizer = FixedQtySizer()
    composite = DefaultComposite(selector, timer, sizer)

    ctx = FakeContext()
    composite.init(ctx)
    composite.on_bars({"600000": _make_bar("600000")}, ctx)

    assert len(ctx.submitted_orders) == 0


def test_default_composite_sell_reduces_position():
    """Sell 信号应清仓（sizer 返回 0）"""

    class SellTimer(TimingStrategy):
        @property
        def meta(self) -> StrategyMeta:
            return StrategyMeta(
                name="sell", description="卖出",
                modes=[ResearchMode.Traditional], params=[], version="0.1.0",
                kind=StrategyKind.Timing,
            )

        def init(self, context) -> None:
            pass

        def signal(self, bar: Bar, context) -> Signal:
            return Signal.Sell

        def finish(self) -> StrategyResult:
            return StrategyResult(meta=self.meta)

    selector = FixedSelector(["600000"])
    timer = SellTimer()
    sizer = FixedQtySizer()  # Sell 时返回 0
    composite = DefaultComposite(selector, timer, sizer)

    ctx = FakeContext()
    # 预设持仓 100 股
    ctx._positions["600000"] = Position(
        symbol="600000", quantity=100, avg_price=10.0,
        market_value=1000, unrealized_pnl=0,
    )
    composite.init(ctx)
    composite.on_bars({"600000": _make_bar("600000")}, ctx)

    assert len(ctx.submitted_orders) == 1
    order = ctx.submitted_orders[0]
    assert order.side == OrderSide.Sell
    assert order.quantity == 100
