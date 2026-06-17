"""选股策略基类测试"""

from quantforge_strategy.selectors import SelectorStrategy
from quantforge_strategy.meta import StrategyMeta, StrategyParamDef
from quantforge_strategy.types import ResearchMode, StrategyKind
from quantforge_strategy.market import Bar, TimeFrame
from quantforge_strategy.result import StrategyResult


class DummySelector(SelectorStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_selector",
            description="测试选股策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Select,
        )

    def init(self, context) -> None:
        pass

    def select(self, bars: dict, context) -> list:
        return list(bars.keys())

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_selector_is_abstract():
    """SelectorStrategy 不能直接实例化"""
    try:
        SelectorStrategy()  # type: ignore[abstract]
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_selector_meta_kind():
    s = DummySelector()
    assert s.meta.kind == StrategyKind.Select


def test_selector_select_returns_symbols():
    s = DummySelector()
    bar = Bar(symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
              open=10, high=11, low=9, close=10.5, volume=1000)
    result = s.select({"600000": bar}, None)  # type: ignore[arg-type]
    assert result == ["600000"]
