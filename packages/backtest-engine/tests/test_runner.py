"""回测运行器集成测试"""

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, TimeFrame, OrderSide, OrderType, OrderRequest,
    ResearchMode,
)
from quantforge_backtest import BacktestRunner, BacktestResult, ASHARE_RULES


class BuyOnSecondBar(Strategy):
    """第二根 bar 提交买单，用于验证 runner 在撮合前补涨停价。"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_on_second_bar", description="第二根买入",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._step = 0

    def on_bar(self, bar: Bar, context) -> None:
        if self._step == 1:
            context.submit_order(OrderRequest(
                symbol=bar.symbol, side=OrderSide.Buy,
                type=OrderType.Market, quantity=100,
            ))
        self._step += 1

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


class BuyAndHold(Strategy):
    """最简单的策略：第一根 bar 全仓买入"""

    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="buy_and_hold", description="买入持有",
            modes=[ResearchMode.Traditional], params=[], version="0.1.0",
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        self._bought = False

    def on_bar(self, bar: Bar, context) -> None:
        if not self._bought:
            account = context.get_account()
            qty = int(account.cash / bar.close)
            if qty > 0:
                context.submit_order(OrderRequest(
                    symbol=bar.symbol, side=OrderSide.Buy,
                    type=OrderType.Market, quantity=qty,
                ))
            self._bought = True

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def _make_bars(n: int, start_price: float = 10.0) -> list[Bar]:
    bars = []
    for i in range(n):
        price = start_price + i * 0.5
        bars.append(Bar(
            symbol="600000", timeframe=TimeFrame.D1, timestamp=i,
            open=price, high=price + 0.1, low=price - 0.1,
            close=price, volume=1000,
        ))
    return bars


def test_runner_basic():
    bars = _make_bars(10, start_price=10.0)
    runner = BacktestRunner(strategy=BuyAndHold(), bars=bars, initial_cash=100000)
    result = runner.run()

    assert isinstance(result, BacktestResult)
    assert result.config.strategy_name == "buy_and_hold"
    assert len(result.equity_curve) == 10
    assert result.metrics.total_trades > 0
    assert result.metrics.total_return != 0


def test_runner_empty_bars():
    runner = BacktestRunner(strategy=BuyAndHold(), bars=[], initial_cash=100000)
    result = runner.run()
    assert result.metrics.total_trades == 0
    assert len(result.equity_curve) == 0


def test_runner_applies_limit_prices_before_matching_pending_order():
    bars = [
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
    ]

    runner = BacktestRunner(
        strategy=BuyOnSecondBar(),
        bars=bars,
        initial_cash=100000,
        market_rules=ASHARE_RULES,
    )
    result = runner.run()

    assert result.trades == []
