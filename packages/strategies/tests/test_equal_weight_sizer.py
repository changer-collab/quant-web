"""等权仓位策略测试"""

from quantforge_strategies.sizers.equal_weight import EqualWeightSizer
from quantforge_strategy import Signal, StrategyKind
from quantforge_strategy.portfolio import Account


class FakeContext:
    def __init__(self, cash: float):
        self._account = Account(initial_cash=cash, cash=cash, equity=cash)

    def get_account(self):
        return self._account


def test_meta():
    s = EqualWeightSizer(max_positions=5)
    assert s.meta.name == "equal_weight"
    assert s.meta.kind == StrategyKind.Position
    assert len(s.meta.params) == 1


def test_init():
    s = EqualWeightSizer(max_positions=10)
    s.init(None)
    assert s._max_positions == 10


def test_size_buy():
    """买入时按等权分配资金"""
    s = EqualWeightSizer(max_positions=5)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 / 5 = 20000 per stock, price=10 → 2000 shares
    qty = s.size("600000", Signal.Buy, 10.0, ctx)
    assert qty == 2000


def test_size_sell():
    """卖出时目标数量为 0（清仓）"""
    s = EqualWeightSizer(max_positions=5)
    s.init(None)

    ctx = FakeContext(cash=100000)
    qty = s.size("600000", Signal.Sell, 10.0, ctx)
    assert qty == 0.0


def test_size_with_different_max_positions():
    s = EqualWeightSizer(max_positions=2)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 / 2 = 50000 per stock, price=20 → 2500 shares
    qty = s.size("600000", Signal.Buy, 20.0, ctx)
    assert qty == 2500
