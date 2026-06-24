"""双均线策略测试"""

from quantforge_strategies.combined.dual_ma import DualMAStrategy
from quantforge_strategy import Bar, OrderSide, TimeFrame


def test_meta():
    s = DualMAStrategy()
    assert s.meta.name == "dual_ma"
    assert len(s.meta.params) == 2


def test_init():
    s = DualMAStrategy(short_period=3, long_period=5)
    s.init(None)  # type: ignore
    assert s._bought is False


def test_golden_cross_triggers_buy():
    """金叉（短均线上穿长均线）应触发买入"""
    s = DualMAStrategy(short_period=2, long_period=3)
    s.init(None)  # type: ignore

    # 构造价格序列：先下跌（短均线 < 长均线），再上涨（短均线 > 长均线）
    prices = [10.0, 9.0, 8.0, 9.0, 10.0, 11.0, 12.0]
    submitted_orders = []

    class MockAccount:
        cash = 100000.0

    class MockPosition:
        def __init__(self, qty=0):
            self.quantity = qty

    class MockContext:
        def get_account(self):
            return MockAccount()

        def get_position(self, symbol):
            return MockPosition(0 if not s._bought else 100)

        def submit_order(self, order):
            submitted_orders.append(order)

    ctx = MockContext()

    for i, price in enumerate(prices):
        bar = Bar(symbol="TEST", timeframe=TimeFrame.D1, timestamp=i,
                  open=price, high=price, low=price, close=price, volume=1000)
        s.on_bar(bar, ctx)

    # 应至少有一笔买入订单
    buy_orders = [o for o in submitted_orders if o.side == OrderSide.Buy]
    assert len(buy_orders) >= 1, "金叉应触发买入"
    assert s._bought is True


def test_death_cross_triggers_sell():
    """死叉（短均线下穿长均线）应触发卖出"""
    s = DualMAStrategy(short_period=2, long_period=3)
    s.init(None)  # type: ignore
    s._bought = True  # 模拟已持仓

    # 构造价格序列：先上涨（短均线 > 长均线），再下跌触发死叉
    prices = [8.0, 10.0, 9.0, 8.0, 7.0, 6.0, 5.0]
    submitted_orders = []

    class MockAccount:
        cash = 0.0

    class MockPosition:
        def __init__(self, qty):
            self.quantity = qty

    class MockContext:
        def get_account(self):
            return MockAccount()

        def get_position(self, symbol):
            return MockPosition(100)

        def submit_order(self, order):
            submitted_orders.append(order)

    ctx = MockContext()

    for i, price in enumerate(prices):
        bar = Bar(symbol="TEST", timeframe=TimeFrame.D1, timestamp=i,
                  open=price, high=price, low=price, close=price, volume=1000)
        s.on_bar(bar, ctx)

    # 应至少有一笔卖出订单
    sell_orders = [o for o in submitted_orders if o.side == OrderSide.Sell]
    assert len(sell_orders) >= 1, "死叉应触发卖出"
    assert s._bought is False


def test_no_signal_no_trade():
    """无金叉/死叉信号时不应下单"""
    s = DualMAStrategy(short_period=2, long_period=3)
    s.init(None)  # type: ignore

    # 持续上涨，短均线一直在长均线上方（无交叉）
    prices = [10.0, 11.0, 12.0, 13.0, 14.0, 15.0]
    submitted_orders = []

    class MockAccount:
        cash = 100000.0

    class MockPosition:
        quantity = 0

    class MockContext:
        def get_account(self):
            return MockAccount()

        def get_position(self, symbol):
            return MockPosition()

        def submit_order(self, order):
            submitted_orders.append(order)

    ctx = MockContext()

    for i, price in enumerate(prices):
        bar = Bar(symbol="TEST", timeframe=TimeFrame.D1, timestamp=i,
                  open=price, high=price, low=price, close=price, volume=1000)
        s.on_bar(bar, ctx)

    assert len(submitted_orders) == 0, "无交叉信号时不应下单"
