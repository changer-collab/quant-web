"""择时策略基类测试"""

from quantforge_strategy.timers import TimingStrategy
from quantforge_strategy.meta import StrategyMeta
from quantforge_strategy.types import ResearchMode, StrategyKind, Signal
from quantforge_strategy.market import Bar, TimeFrame
from quantforge_strategy.result import StrategyResult


class DummyTimer(TimingStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_timer",
            description="测试择时策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Timing,
        )

    def init(self, context) -> None:
        pass

    def signal(self, bar: Bar, context) -> Signal:
        return Signal.Hold

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_timer_is_abstract():
    try:
        TimingStrategy()  # type: ignore[abstract]
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_timer_meta_kind():
    s = DummyTimer()
    assert s.meta.kind == StrategyKind.Timing


def test_timer_signal():
    s = DummyTimer()
    bar = Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
              open=10, high=11, low=9, close=10.5, volume=1000)
    assert s.signal(bar, None) == Signal.Hold  # type: ignore[arg-type]
