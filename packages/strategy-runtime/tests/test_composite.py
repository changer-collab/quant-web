"""组合策略基类测试"""

from quantforge_strategy.composite import CompositeStrategy
from quantforge_strategy.meta import StrategyMeta
from quantforge_strategy.types import ResearchMode, StrategyKind, StrategyState
from quantforge_strategy.market import Bar, TimeFrame
from quantforge_strategy.result import StrategyResult


class DummyComposite(CompositeStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_composite",
            description="测试组合策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Composite,
        )

    @property
    def state(self) -> StrategyState:
        return StrategyState.Idle

    def init(self, context) -> None:
        pass

    def on_bars(self, bars: dict, context) -> None:
        pass

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_composite_is_abstract():
    try:
        CompositeStrategy()  # type: ignore[abstract]
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_composite_meta_kind():
    s = DummyComposite()
    assert s.meta.kind == StrategyKind.Composite


def test_composite_on_bars():
    s = DummyComposite()
    bar = Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
              open=10, high=11, low=9, close=10.5, volume=1000)
    s.on_bars({"600000": bar}, None)  # type: ignore[arg-type]
