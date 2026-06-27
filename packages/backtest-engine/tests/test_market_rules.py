"""A 股市场规则测试"""

from types import SimpleNamespace

from quantforge_strategy import Bar, Order, OrderSide, OrderType, OrderStatus, TimeFrame
from quantforge_backtest.matcher import Matcher
from quantforge_backtest.portfolio import PortfolioManager
from quantforge_backtest.market_rules import MarketRules, ASHARE_RULES, NO_RULES


def _make_bar(close: float, low: float = 0.0, high: float = 0.0) -> Bar:
    return Bar(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=1000,
        open=close, high=high or close * 1.02, low=low or close * 0.98,
        close=close, volume=1000,
    )


# ===== MarketRules 单元测试 =====

def test_market_rules_defaults():
    rules = MarketRules()
    assert rules.lot_size == 100
    assert rules.stamp_duty_rate == 0.0005
    assert rules.commission_rate == 0.00025
    assert rules.min_commission == 5.0
    assert rules.enable_t_plus_1 is True
    assert rules.enable_lot_size is True


def test_is_sh_symbol():
    rules = MarketRules()
    assert rules.is_sh_symbol("600000") is True   # 沪市主板
    assert rules.is_sh_symbol("688001") is True   # 科创板
    assert rules.is_sh_symbol("000001") is False  # 深市主板
    assert rules.is_sh_symbol("300001") is False  # 创业板


def test_round_to_lot_buy():
    rules = MarketRules()
    # 买入：向下取整到 100 股
    assert rules.round_to_lot(150) == 100
    assert rules.round_to_lot(250) == 200
    assert rules.round_to_lot(100) == 100


def test_round_to_lot_sell():
    rules = MarketRules()
    # 卖出：允许零股
    assert rules.round_to_lot(150, is_sell=True) == 150
    assert rules.round_to_lot(100, is_sell=True) == 100


def test_calc_commission():
    rules = MarketRules()
    # 大额：按比例计算
    assert rules.calc_commission(100000) == 25.0  # 100000 * 0.00025
    # 小额：取最低 5 元
    assert rules.calc_commission(1000) == 5.0
    assert rules.calc_commission(100) == 5.0


def test_calc_stamp_duty():
    rules = MarketRules()
    # 卖出收印花税
    assert rules.calc_stamp_duty(10000, is_sell=True) == 5.0  # 10000 * 0.0005
    # 买入不收
    assert rules.calc_stamp_duty(10000, is_sell=False) == 0.0


def test_calc_transfer_fee():
    rules = MarketRules()
    # 沪市收过户费
    assert rules.calc_transfer_fee(10000, "600000") == 0.1  # 10000 * 0.00001
    # 深市不收
    assert rules.calc_transfer_fee(10000, "000001") == 0.0


def test_calc_total_cost_buy_sh():
    rules = MarketRules()
    # 沪市买入：佣金（无印花税）+ 过户费
    amount = 10000.0
    cost = rules.calc_total_cost(amount, "600000", is_sell=False)
    expected = rules.calc_commission(amount) + rules.calc_transfer_fee(amount, "600000")
    assert cost == expected


def test_calc_total_cost_sell_sh():
    rules = MarketRules()
    # 沪市卖出：佣金 + 印花税 + 过户费
    amount = 10000.0
    cost = rules.calc_total_cost(amount, "600000", is_sell=True)
    expected = (
        rules.calc_commission(amount)
        + rules.calc_stamp_duty(amount, is_sell=True)
        + rules.calc_transfer_fee(amount, "600000")
    )
    assert cost == expected


def test_no_rules_zero_cost():
    rules = NO_RULES
    assert rules.calc_total_cost(10000, "600000", is_sell=True) == 0.0


def test_calc_limit_prices_default_10_percent():
    rules = MarketRules()
    assert rules.calc_limit_prices(10.0) == (11.0, 9.0)


def test_calc_limit_prices_star_market_20_percent():
    rules = MarketRules()
    assert rules.calc_limit_prices(10.0, symbol="688001") == (12.0, 8.0)


# ===== Matcher 集成测试 =====

def test_matcher_t_plus_1_blocks_sell():
    """T+1：可卖数量不足时卖出订单被拒绝"""
    rules = ASHARE_RULES
    matcher = Matcher(slippage=0.0, market_rules=rules)
    order = Order(id="o1", symbol="600000", side=OrderSide.Sell,
                  type=OrderType.Market, quantity=100)
    bar = _make_bar(10.0)
    # available_qty=0，T+1 锁定
    trade = matcher.match(order, bar, available_qty=0.0)
    assert trade is None


def test_matcher_t_plus_1_allows_sell_next_day():
    """T+1：可卖数量足够时卖出订单成交"""
    rules = ASHARE_RULES
    matcher = Matcher(slippage=0.0, market_rules=rules)
    order = Order(id="o1", symbol="600000", side=OrderSide.Sell,
                  type=OrderType.Market, quantity=100)
    bar = _make_bar(10.0)
    # available_qty=100，可卖
    trade = matcher.match(order, bar, available_qty=100.0)
    assert trade is not None


def test_matcher_lot_size_rejects_odd_buy():
    """最小交易单位：买入 150 股（非 100 整数倍）被拒绝"""
    rules = ASHARE_RULES
    matcher = Matcher(slippage=0.0, market_rules=rules)
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Market, quantity=150)
    bar = _make_bar(10.0)
    trade = matcher.match(order, bar)
    assert trade is None


def test_matcher_lot_size_allows_100_buy():
    """最小交易单位：买入 200 股成交"""
    rules = ASHARE_RULES
    matcher = Matcher(slippage=0.0, market_rules=rules)
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Market, quantity=200)
    bar = _make_bar(10.0)
    trade = matcher.match(order, bar)
    assert trade is not None


def test_matcher_no_rules_backward_compatible():
    """无规则时向后兼容：150 股买入可成交"""
    matcher = Matcher(slippage=0.0, market_rules=None)
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Market, quantity=150)
    bar = _make_bar(10.0)
    trade = matcher.match(order, bar)
    assert trade is not None


def test_matcher_blocks_buy_at_limit_up():
    matcher = Matcher(slippage=0.0, market_rules=ASHARE_RULES)
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Market, quantity=100)
    bar = Bar(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=1000,
        open=10.9, high=11.0, low=10.8, close=11.0, volume=1000,
        limit_up=11.0, limit_down=9.0,
    )

    assert matcher.match(order, bar) is None


def test_matcher_blocks_sell_at_limit_down():
    matcher = Matcher(slippage=0.0, market_rules=ASHARE_RULES)
    order = Order(id="o1", symbol="600000", side=OrderSide.Sell,
                  type=OrderType.Market, quantity=100)
    bar = Bar(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=1000,
        open=9.1, high=9.2, low=9.0, close=9.0, volume=1000,
        limit_up=11.0, limit_down=9.0,
    )

    assert matcher.match(order, bar, available_qty=100.0) is None


def test_matcher_blocks_suspended_bar():
    matcher = Matcher(slippage=0.0, market_rules=ASHARE_RULES)
    buy = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                type=OrderType.Market, quantity=100)
    sell = Order(id="o2", symbol="600000", side=OrderSide.Sell,
                 type=OrderType.Market, quantity=100)
    bar = Bar(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=1000,
        open=10.0, high=10.0, low=10.0, close=10.0, volume=0,
        is_suspended=True,
    )

    assert matcher.match(buy, bar) is None
    assert matcher.match(sell, bar, available_qty=100.0) is None


def test_matcher_accepts_legacy_bar_without_limit_fields():
    matcher = Matcher(slippage=0.0, market_rules=ASHARE_RULES)
    order = Order(id="o1", symbol="600000", side=OrderSide.Buy,
                  type=OrderType.Market, quantity=100)
    legacy_bar = SimpleNamespace(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=1000,
        open=11.0, high=11.0, low=11.0, close=11.0, volume=1000,
    )

    assert matcher.match(order, legacy_bar) is not None


# ===== PortfolioManager 集成测试 =====

def test_portfolio_t_plus_1_locks_buy_day():
    """T+1：买入当日 available_qty=0"""
    from quantforge_strategy import Trade
    pm = PortfolioManager(100000, market_rules=ASHARE_RULES)
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    pos = pm.get_position("600000")
    assert pos is not None
    assert pos.quantity == 100
    assert pos.available_qty == 0  # T+1 锁定


def test_portfolio_t_plus_1_unlocks_next_day():
    """T+1：下一交易日解锁"""
    from quantforge_strategy import Trade
    pm = PortfolioManager(100000, market_rules=ASHARE_RULES)
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    # 解锁
    pm.unlock_t_plus_1()
    pos = pm.get_position("600000")
    assert pos is not None
    assert pos.available_qty == 100


def test_portfolio_no_rules_available_equals_quantity():
    """无规则时 available_qty == quantity（向后兼容）"""
    from quantforge_strategy import Trade
    pm = PortfolioManager(100000, market_rules=None)
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    pos = pm.get_position("600000")
    assert pos is not None
    assert pos.available_qty == 100


def test_portfolio_deducts_buy_cost():
    """买入扣除金额 + 佣金"""
    from quantforge_strategy import Trade
    pm = PortfolioManager(100000, market_rules=ASHARE_RULES)
    # 买入 100 股 @ 10 元 = 1000 元
    # 佣金 = max(1000 * 0.00025, 5) = 5 元
    # 过户费（沪市）= 1000 * 0.00001 = 0.01 元
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    account = pm.get_account()
    # 现金 = 100000 - 1000 - 5 - 0.01 = 98994.99
    assert abs(account.cash - 98994.99) < 0.01


def test_portfolio_deducts_sell_cost():
    """卖出扣除印花税 + 佣金 + 过户费"""
    from quantforge_strategy import Trade
    pm = PortfolioManager(100000, market_rules=ASHARE_RULES)
    # 先买入
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=100, timestamp=0)
    pm.apply_trade(buy)
    # 解锁 T+1
    pm.unlock_t_plus_1()
    # 卖出 100 股 @ 11 元 = 1100 元
    # 佣金 = max(1100 * 0.00025, 5) = 5 元
    # 印花税 = 1100 * 0.0005 = 0.55 元
    # 过户费 = 1100 * 0.00001 = 0.011 元
    sell = Trade(id="t2", order_id="o2", symbol="600000",
                 side=OrderSide.Sell, price=11.0, quantity=100, timestamp=1)
    pm.apply_trade(sell)
    account = pm.get_account()
    # 现金 = 98994.99 + 1100 - 5 - 0.55 - 0.011 = 100089.429
    assert abs(account.cash - 100089.429) < 0.01


def test_portfolio_sell_reduces_available_qty():
    """卖出后 available_qty 同步减少"""
    from quantforge_strategy import Trade
    pm = PortfolioManager(100000, market_rules=ASHARE_RULES)
    buy = Trade(id="t1", order_id="o1", symbol="600000",
                side=OrderSide.Buy, price=10.0, quantity=200, timestamp=0)
    pm.apply_trade(buy)
    pm.unlock_t_plus_1()
    # 卖出 50 股
    sell = Trade(id="t2", order_id="o2", symbol="600000",
                 side=OrderSide.Sell, price=11.0, quantity=50, timestamp=1)
    pm.apply_trade(sell)
    pos = pm.get_position("600000")
    assert pos is not None
    assert pos.quantity == 150
    assert pos.available_qty == 150  # 200 - 50
