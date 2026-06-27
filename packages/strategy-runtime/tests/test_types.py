"""枚举类型测试"""

from quantforge_strategy import Bar
from quantforge_strategy.types import (
    OrderSide, OrderType, OrderStatus, StrategyState,
    ParamType, TimeFrame, ResearchMode, TaskStatus, TaskType,
    StrategyKind, Signal,
)


def test_order_side():
    assert OrderSide.Buy == "buy"
    assert OrderSide.Sell == "sell"


def test_order_type():
    assert OrderType.Market == "market"
    assert OrderType.Limit == "limit"


def test_order_status():
    assert OrderStatus.Pending == "pending"
    assert OrderStatus.Filled == "filled"
    assert OrderStatus.Canceled == "canceled"
    assert OrderStatus.Rejected == "rejected"


def test_strategy_state():
    assert StrategyState.Idle == "idle"
    assert StrategyState.Running == "running"
    assert StrategyState.Stopped == "stopped"
    assert StrategyState.Error == "error"


def test_param_type():
    assert ParamType.Number == "number"
    assert ParamType.String == "string"
    assert ParamType.Boolean == "boolean"
    assert ParamType.Select == "select"


def test_timeframe():
    assert TimeFrame.M1 == "1m"
    assert TimeFrame.D1 == "1d"


def test_research_mode():
    assert ResearchMode.Traditional == "traditional"
    assert ResearchMode.HighFrequency == "highFrequency"
    assert ResearchMode.AI == "ai"


def test_task_status():
    assert TaskStatus.Pending == "pending"
    assert TaskStatus.Running == "running"
    assert TaskStatus.Completed == "completed"
    assert TaskStatus.Failed == "failed"
    assert TaskStatus.Cancelled == "cancelled"


def test_task_type():
    assert TaskType.Backtest == "backtest"
    assert TaskType.Training == "training"
    assert TaskType.FactorCompute == "factorCompute"
    assert TaskType.FactorEval == "factorEval"


def test_strategy_kind():
    assert StrategyKind.Combined == "combined"
    assert StrategyKind.Select == "select"
    assert StrategyKind.Timing == "timing"
    assert StrategyKind.Position == "position"
    assert StrategyKind.Composite == "composite"


def test_signal():
    assert Signal.Buy == "buy"
    assert Signal.Sell == "sell"
    assert Signal.Hold == "hold"


def test_bar_has_optional_limit_and_suspension_fields():
    legacy_bar = Bar(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=0,
        open=10, high=11, low=9, close=10.5, volume=1000,
    )
    assert legacy_bar.limit_up is None
    assert legacy_bar.limit_down is None
    assert legacy_bar.is_suspended is False

    halted_bar = Bar(
        symbol="600000", timeframe=TimeFrame.D1, timestamp=1,
        open=10, high=10, low=10, close=10, volume=0,
        limit_up=11.0, limit_down=9.0, is_suspended=True,
    )
    assert halted_bar.limit_up == 11.0
    assert halted_bar.limit_down == 9.0
    assert halted_bar.is_suspended is True
