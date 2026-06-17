"""订单类型测试"""

from quantforge_strategy.order import Order, Trade, OrderRequest
from quantforge_strategy.types import OrderSide, OrderType, OrderStatus


def test_order_creation():
    o = Order(
        id="o1", symbol="600000", side=OrderSide.Buy,
        type=OrderType.Market, quantity=100,
    )
    assert o.id == "o1"
    assert o.symbol == "600000"
    assert o.side == OrderSide.Buy
    assert o.type == OrderType.Market
    assert o.quantity == 100
    assert o.filled_qty == 0.0
    assert o.price is None
    assert o.status == OrderStatus.Pending


def test_order_frozen():
    o = Order(id="o1", symbol="600000", side=OrderSide.Buy,
              type=OrderType.Market, quantity=100)
    try:
        o.id = "o2"  # type: ignore
        assert False, "should be frozen"
    except AttributeError:
        pass


def test_trade_creation():
    t = Trade(
        id="t1", order_id="o1", symbol="600000",
        side=OrderSide.Buy, price=10.5, quantity=100, timestamp=1000,
    )
    assert t.id == "t1"
    assert t.order_id == "o1"
    assert t.price == 10.5


def test_order_request():
    r = OrderRequest(
        symbol="600000", side=OrderSide.Sell,
        type=OrderType.Limit, quantity=200, price=11.0,
    )
    assert r.symbol == "600000"
    assert r.side == OrderSide.Sell
    assert r.price == 11.0


def test_order_request_no_price():
    r = OrderRequest(
        symbol="600000", side=OrderSide.Buy,
        type=OrderType.Market, quantity=100,
    )
    assert r.price is None
