"""仓位管理策略基类测试"""

from quantforge_strategy.sizers import PositionStrategy
from quantforge_strategy.meta import StrategyMeta
from quantforge_strategy.types import ResearchMode, StrategyKind, Signal
from quantforge_strategy.result import StrategyResult


class DummySizer(PositionStrategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="dummy_sizer",
            description="测试仓位策略",
            modes=[ResearchMode.Traditional],
            params=[],
            version="0.1.0",
            kind=StrategyKind.Position,
        )

    def init(self, context) -> None:
        pass

    def size(self, symbol: str, signal: Signal, price: float,
             context) -> float:
        return 100.0

    def finish(self) -> StrategyResult:
        return StrategyResult(meta=self.meta)


def test_sizer_is_abstract():
    try:
        PositionStrategy()  # type: ignore[abstract]
        assert False, "should raise TypeError"
    except TypeError:
        pass


def test_sizer_meta_kind():
    s = DummySizer()
    assert s.meta.kind == StrategyKind.Position


def test_sizer_size():
    s = DummySizer()
    qty = s.size("600000", Signal.Buy, 10.0, None)  # type: ignore[arg-type]
    assert qty == 100.0
