"""循环引擎类型骨架基础测试"""

from quantforge_loop import (
    IterationRecord,
    IterationStatus,
    LoopCondition,
    LoopConfig,
    LoopRecord,
    LoopStatus,
    LoopSummary,
    LoopType,
)


def test_loop_type_values():
    assert LoopType.BacktestToReport.value == "backtest_to_report"
    assert LoopType.FactorMining.value == "factor_mining"


def test_loop_status_values():
    assert LoopStatus.Pending.value == "pending"
    assert LoopStatus.Completed.value == "completed"


def test_iteration_status_values():
    assert IterationStatus.Running.value == "running"
    assert IterationStatus.Skipped.value == "skipped"


def test_loop_config_defaults():
    config = LoopConfig(id="loop-1", type=LoopType.BacktestToReport)
    assert config.max_iterations == 10
    assert config.subtask_config == {}


def test_iteration_record_defaults():
    record = IterationRecord(id="iter-1", loop_id="loop-1", sequence=1)
    assert record.status == IterationStatus.Pending
    assert record.subtask_id is None
    assert record.summary == {}


def test_loop_summary_defaults():
    summary = LoopSummary()
    assert summary.total_iterations == 0
    assert summary.best_result is None


def test_loop_record_defaults():
    config = LoopConfig(id="loop-1", type=LoopType.BacktestToReport)
    record = LoopRecord(id="loop-1", config=config)
    assert record.status == LoopStatus.Pending
    assert record.iterations == []
    assert record.summary is None


def test_loop_condition_protocol():
    """LoopCondition 是 Protocol，任何实现 should_stop 方法的对象都满足"""

    class MaxIterationsCondition:
        def __init__(self, max_iter: int):
            self._max_iter = max_iter

        def should_stop(self, record: LoopRecord) -> bool:
            completed = sum(
                1 for i in record.iterations if i.status == IterationStatus.Completed
            )
            return completed >= self._max_iter

    config = LoopConfig(id="loop-1", type=LoopType.BacktestToReport, max_iterations=2)
    record = LoopRecord(id="loop-1", config=config)
    condition: LoopCondition = MaxIterationsCondition(2)

    assert condition.should_stop(record) is False

    record.iterations.append(
        IterationRecord(id="i1", loop_id="loop-1", sequence=1, status=IterationStatus.Completed)
    )
    record.iterations.append(
        IterationRecord(id="i2", loop_id="loop-1", sequence=2, status=IterationStatus.Completed)
    )
    assert condition.should_stop(record) is True
