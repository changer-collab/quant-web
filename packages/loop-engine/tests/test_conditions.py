"""循环终止条件纯函数测试"""

from quantforge_loop.types import (
    IterationRecord,
    IterationStatus,
    LoopConfig,
    LoopRecord,
    LoopType,
)
from quantforge_loop.conditions import (
    ConvergenceCheck,
    DrawdownStop,
    MaxIterations,
    NoImprovementStop,
)


def _make_record(n: int, summaries: list[dict] | None = None) -> LoopRecord:
    config = LoopConfig(id="test", type=LoopType.StrategyOptimization)
    iterations = []
    for i in range(n):
        s = summaries[i] if summaries else {}
        iterations.append(
            IterationRecord(
                id=f"iter-{i}",
                loop_id="test",
                sequence=i,
                status=IterationStatus.Completed,
                summary=s,
            )
        )
    return LoopRecord(id="test", config=config, iterations=iterations)


def test_max_iterations_stop():
    cond = MaxIterations(3)
    assert not cond.should_stop(_make_record(0))
    assert not cond.should_stop(_make_record(2))
    assert cond.should_stop(_make_record(3))
    assert cond.should_stop(_make_record(5))


def test_max_iterations_no_stop_under_limit():
    cond = MaxIterations(10)
    assert not cond.should_stop(_make_record(5))


def test_convergence_not_enough_iterations():
    cond = ConvergenceCheck(patience=3, min_improvement=0.001)
    assert not cond.should_stop(_make_record(2))


def test_convergence_detected():
    cond = ConvergenceCheck(patience=2, min_improvement=0.001)
    # 3 次迭代，后 2 次改善 < 0.001
    summaries = [
        {"best_metric": 0.1},
        {"best_metric": 0.1005},
        {"best_metric": 0.1008},
    ]
    assert cond.should_stop(_make_record(3, summaries))


def test_convergence_not_detected():
    cond = ConvergenceCheck(patience=2, min_improvement=0.001)
    summaries = [
        {"best_metric": 0.1},
        {"best_metric": 0.105},
        {"best_metric": 0.115},
    ]
    assert not cond.should_stop(_make_record(3, summaries))


def test_drawdown_stop():
    cond = DrawdownStop(max_drawdown=-0.2)
    assert not cond.should_stop(_make_record(0))
    assert not cond.should_stop(_make_record(1, [{"max_drawdown": -0.1}]))
    assert cond.should_stop(_make_record(1, [{"max_drawdown": -0.25}]))


def test_no_improvement_stop():
    cond = NoImprovementStop(patience=3)
    summaries = [
        {"best_metric": 0.1},
        {"best_metric": 0.1},  # 无改善
        {"best_metric": 0.1},  # 无改善
    ]
    assert cond.should_stop(_make_record(3, summaries))

    summaries2 = [
        {"best_metric": 0.1},
        {"best_metric": 0.1},
        {"best_metric": 0.105},  # 有改善
    ]
    assert not cond.should_stop(_make_record(3, summaries2))
