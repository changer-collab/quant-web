"""策略抽象基类测试"""

from quantforge_strategy.strategy import Strategy
from quantforge_strategy.meta import StrategyMeta, StrategyParamDef
from quantforge_strategy.types import StrategyState, ResearchMode, ParamType
from quantforge_strategy.market import Bar, TimeFrame
from quantforge_strategy.result import StrategyResult


class SimpleStrategy(Strategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="simple",
            description="测试策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        pass

    def on_bar(self, bar: Bar, context) -> None:
        pass

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_strategy_meta():
    s = SimpleStrategy()
    assert s.meta.name == "simple"
    assert s.meta.modes == [ResearchMode.Traditional]


def test_strategy_state():
    s = SimpleStrategy()
    assert s.state == StrategyState.Idle


def test_strategy_finish():
    s = SimpleStrategy()
    result = s.finish()
    assert isinstance(result, StrategyResult)
    assert result.meta.name == "simple"
    assert result.orders == []
    assert result.trades == []


def test_strategy_on_tick_default():
    """on_tick 默认空实现"""
    s = SimpleStrategy()
    tick = Bar(symbol="600000", timeframe=TimeFrame.D1,
               timestamp=0, open=10, high=11, low=9, close=10.5, volume=1000)
    # 不应抛异常
    s.on_tick(tick, None)  # type: ignore


def test_strategy_on_order_default():
    """on_order 默认空实现"""
    s = SimpleStrategy()
    s.on_order(None, None)  # type: ignore
