"""QuantForge 循环引擎 — 类型骨架与条件判断纯函数"""

__version__ = "0.1.0"

from .conditions import (
    ConvergenceCheck,
    DrawdownStop,
    MaxIterations,
    NoImprovementStop,
)
from .types import (
    IterationRecord,
    IterationStatus,
    LoopCondition,
    LoopConfig,
    LoopRecord,
    LoopStatus,
    LoopSummary,
    LoopType,
)

__all__ = [
    "LoopType",
    "LoopStatus",
    "IterationStatus",
    "LoopConfig",
    "IterationRecord",
    "LoopRecord",
    "LoopCondition",
    "LoopSummary",
    "MaxIterations",
    "ConvergenceCheck",
    "DrawdownStop",
    "NoImprovementStop",
]
