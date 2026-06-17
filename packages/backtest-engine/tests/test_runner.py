"""回测运行器集成测试"""

from quantforge_strategy import (
    Strategy, StrategyMeta, StrategyResult, StrategyState,
    Bar, TimeFrame, OrderSide, OrderType, OrderRequest,
    ResearchMode,
)
from quantforge_backtest import BacktestRunner, BacktestResult


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
