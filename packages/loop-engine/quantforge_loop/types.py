"""循环引擎类型骨架 — 循环生命周期类型、终止条件判断纯函数接口和循环汇总结构。

本模块只定义类型，不实现调度引擎、不做状态持久化、不自带进程入口。
循环的调度编排由 Worker 负责，循环状态持久化由 Worker 通过 API 任务表实现。
迭代结果（IterationRecord）只存引用（子任务 ID、结果摘要），不内联其他引擎的完整结果类型。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol


class LoopType(str, Enum):
    """循环类型 — 定义循环工程的不同模式"""

    BacktestToReport = "backtest_to_report"
    BacktestToObsidian = "backtest_to_obsidian"
    FactorMining = "factor_mining"
    StrategyOptimization = "strategy_optimization"
    AiTrainPredict = "ai_train_predict"


class LoopStatus(str, Enum):
    """循环状态"""

    Pending = "pending"
    Running = "running"
    Paused = "paused"
    Completed = "completed"
    Failed = "failed"
    Cancelled = "cancelled"


class IterationStatus(str, Enum):
    """迭代状态"""

    Pending = "pending"
    Running = "running"
    Completed = "completed"
    Failed = "failed"
    Skipped = "skipped"


@dataclass
class LoopConfig:
    """循环配置 — 定义循环的运行参数"""

    id: str
    type: LoopType
    max_iterations: int = 10
    subtask_config: dict[str, object] = field(default_factory=dict)


@dataclass
class IterationRecord:
    """迭代记录 — 只存引用和摘要，不内联其他引擎的完整结果类型"""

    id: str
    loop_id: str
    sequence: int
    status: IterationStatus = IterationStatus.Pending
    subtask_id: str | None = None
    summary: dict[str, object] = field(default_factory=dict)
    started_at: int | None = None
    completed_at: int | None = None


@dataclass
class LoopSummary:
    """循环汇总结构 — 循环完成后的统计摘要"""

    total_iterations: int = 0
    completed_iterations: int = 0
    failed_iterations: int = 0
    duration_ms: int | None = None
    best_result: dict[str, object] | None = None


@dataclass
class LoopRecord:
    """循环记录 — 持有循环的完整运行记录（状态由 Worker 通过 API 任务表持久化）"""

    id: str
    config: LoopConfig
    status: LoopStatus = LoopStatus.Pending
    iterations: list[IterationRecord] = field(default_factory=list)
    started_at: int | None = None
    completed_at: int | None = None
    summary: LoopSummary | None = None


class LoopCondition(Protocol):
    """终止条件判断纯函数接口 — 判断循环是否应该停止

    实现者只需提供 ``should_stop`` 方法，返回 True 则循环停止。
    本接口是纯函数，不持有状态，不产生副作用。
    """

    def should_stop(self, record: LoopRecord) -> bool:
        """判断循环是否应停止

        Args:
            record: 当前循环记录（含所有已完成的迭代）

        Returns:
            True 表示循环应停止，False 表示应继续
        """
        ...
