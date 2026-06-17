"""持仓管理器测试"""

from quantforge_strategy import Trade, OrderSide
from quantforge_backtest.portfolio import PortfolioManager


def test_initial_account():
    pm = PortfolioManager(100000)
    account = pm.get_account()
    assert account.cash == 100000
    assert account.equity == 100000
    assert len(account.positions) == 0


def test_buy_creates_position():
    pm = PortfolioManager(100000)
    trade = Trade(id="t1", order_id="o1", symbol="600000",
                  side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(trade)
    pos = pm.get_position("600000")
    assert pos is not None
    assert pos.quantity == 100
    assert pos.avg_price == 10.0
    account = pm.get_account()
    assert account.cash == 100000 - 1000  # 100000 - 10*100


def test_sell_reduces_position():
    pm = PortfolioManager(100000)
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    sell = Trade(id="t2", order_id="o2", symbol="600000",
                 side=OrderSide.Sell, price=11.0, quantity=50, timestamp=1)
    pm.apply_trade(sell)
    pos = pm.get_position("600000")
    assert pos is not None
    assert pos.quantity == 50
    assert pos.avg_price == 10.0
    account = pm.get_account()
    assert account.cash == 100000 - 1000 + 550  # 99550


def test_sell_all_closes_position():
    pm = PortfolioManager(100000)
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    sell = Trade(id="t2", order_id="o2", symbol="600000",
                 side=OrderSide.Sell, price=11.0, quantity=100, timestamp=1)
    pm.apply_trade(sell)
    assert pm.get_position("600000") is None


def test_update_market_price():
    pm = PortfolioManager(100000)
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    pm.update_market_price("600000", 12.0)
    pos = pm.get_position("600000")
    assert pos is not None
    assert pos.market_value == 1200
    assert pos.unrealized_pnl == 200
