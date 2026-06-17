"""固定比例仓位策略测试"""

from quantforge_strategies.sizers.fixed_fraction import FixedFractionSizer
from quantforge_strategy import Signal, StrategyKind
from quantforge_strategy.portfolio import Account


class FakeContext:
    def __init__(self, cash: float):
        self._account = Account(initial_cash=cash, cash=cash, equity=cash)

    def get_account(self):
        return self._account


def test_meta():
    s = FixedFractionSizer(fraction=0.1)
    assert s.meta.name == "fixed_fraction"
    assert s.meta.kind == StrategyKind.Position
    assert len(s.meta.params) == 1


def test_init():
    s = FixedFractionSizer(fraction=0.2)
    s.init(None)
    assert s._fraction == 0.2


def test_size_buy():
    """买入时按固定比例分配资金"""
    s = FixedFractionSizer(fraction=0.1)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 * 0.1 = 10000, price=10 → 1000 shares
    qty = s.size("600000", Signal.Buy, 10.0, ctx)
    assert qty == 1000


def test_size_sell():
    """卖出时目标数量为 0"""
    s = FixedFractionSizer(fraction=0.1)
    s.init(None)

    ctx = FakeContext(cash=100000)
    qty = s.size("600000", Signal.Sell, 10.0, ctx)
    assert qty == 0.0


def test_size_different_fraction():
    s = FixedFractionSizer(fraction=0.25)
    s.init(None)

    ctx = FakeContext(cash=100000)
    # 100000 * 0.25 = 25000, price=20 → 1250 shares
    qty = s.size("600000", Signal.Buy, 20.0, ctx)
    assert qty == 1250
