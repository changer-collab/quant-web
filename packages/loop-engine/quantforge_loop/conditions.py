"""循环终止条件判断纯函数集合"""

from __future__ import annotations

from .types import IterationRecord, IterationStatus, LoopCondition, LoopRecord


class MaxIterations(LoopCondition):
    """达到最大迭代次数时停止"""

    def __init__(self, max_iterations: int) -> None:
        self._max = max_iterations

    def should_stop(self, record: LoopRecord) -> bool:
        return len(record.iterations) >= self._max


class ConvergenceCheck(LoopCondition):
    """连续 N 次迭代结果改善低于阈值时停止"""

    def __init__(self, patience: int = 3, min_improvement: float = 0.001) -> None:
        self._patience = patience
        self._min_improvement = min_improvement

    def should_stop(self, record: LoopRecord) -> bool:
        if len(record.iterations) < self._patience + 1:
            return False
        recent = record.iterations[-self._patience - 1 :]
        improvements = []
        for i in range(1, len(recent)):
            prev_best = recent[i - 1].summary.get("best_metric", 0)
            curr_best = recent[i].summary.get("best_metric", 0)
            improvements.append(curr_best - prev_best)
        return all(abs(imp) < self._min_improvement for imp in improvements)


class DrawdownStop(LoopCondition):
    """回撤超过阈值时停止"""

    def __init__(self, max_drawdown: float = -0.2) -> None:
        self._max_dd = max_drawdown

    def should_stop(self, record: LoopRecord) -> bool:
        for it in record.iterations:
            dd = it.summary.get("max_drawdown", 0)
            if dd <= self._max_dd:
                return True
        return False


class NoImprovementStop(LoopCondition):
    """连续 N 次迭代无改善时停止"""

    def __init__(self, patience: int = 5) -> None:
        self._patience = patience

    def should_stop(self, record: LoopRecord) -> bool:
        if len(record.iterations) < self._patience:
            return False
        recent = record.iterations[-self._patience :]
        # 从第一个元素开始跟踪最大值，检查后续元素是否有改善
        best_so_far = recent[0].summary.get("best_metric", 0)
        for it in recent[1:]:
            best = it.summary.get("best_metric", 0)
            if best > best_so_far:
                return False
            best_so_far = max(best_so_far, best)
        return True
