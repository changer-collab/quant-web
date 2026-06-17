"""撮合器测试"""

from quantforge_strategy import Bar, Order, OrderSide, OrderType, OrderStatus, TimeFrame
from quantforge_backtest.matcher import Matcher


def _make_bar(close: float, low: float = 0.0, high: float = 0.0) -> Bar:
    return Bar(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=1000,
        open=close, high=high or close * 1.02, low=low or close * 0.98,
        close=close, volume=1000,
    )


def test_market_buy():
    matcher = Matcher(slippage=0.01)
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Market, quantity=100)
    bar = _make_bar(10.0)
    trade = matcher.match(order, bar)
    assert trade is not None
    assert trade.price == round(10.0 * 1.01, 2)  # 10.1


def test_market_sell():
    matcher = Matcher(slippage=0.01)
    order = Order(id="o1", symbol="600000", side=OrderSide.Sell,
                  type=OrderType.Market, quantity=100)
    bar = _make_bar(10.0)
    trade = matcher.match(order, bar)
    assert trade is not None
    assert trade.price == round(10.0 * 0.99, 2)  # 9.9


def test_limit_buy_hit():
    matcher = Matcher()
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Limit, quantity=100, price=9.5)
    bar = _make_bar(10.0, low=9.0)
    trade = matcher.match(order, bar)
    assert trade is not None
    assert trade.price == 9.5


def test_limit_buy_miss():
    matcher = Matcher()
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Limit, quantity=100, price=9.0)
    bar = _make_bar(10.0, low=9.5)
    trade = matcher.match(order, bar)
    assert trade is None


def test_limit_sell_hit():
    matcher = Matcher()
    order = Order(id="o1", symbol="600000", side=OrderSide.Sell,
                  type=OrderType.Limit, quantity=100, price=10.5)
    bar = _make_bar(10.0, high=11.0)
    trade = matcher.match(order, bar)
    assert trade is not None
    assert trade.price == 10.5


def test_filled_order_skipped():
    matcher = Matcher()
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Market, quantity=100, status=OrderStatus.Filled)
    bar = _make_bar(10.0)
    trade = matcher.match(order, bar)
    assert trade is None
