"""因子工坊类型定义"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

from quantforge_strategy import TimeFrame, ResearchMode


class FactorEvalTab(str, Enum):
    Sorting = "sorting"
    ICAnalysis = "icAnalysis"
    Regression = "regression"


class FactorStatus(str, Enum):
    Active = "active"
    Deprecated = "deprecated"
    Draft = "draft"


@dataclass(frozen=True)
class FactorDefinition:
    id: str
    name: str
    formula: str
    category: str
    modes: list[ResearchMode]
    frequency: TimeFrame
    status: FactorStatus = FactorStatus.Draft
    version: str = "0.1.0"


@dataclass(frozen=True)
class FactorMetrics:
    ic: float = 0.0
    rank_ic: float = 0.0
    long_short_return: float = 0.0
    max_drawdown: float = 0.0
    ic_win_rate: float = 0.0
    turnover: float = 0.0


@dataclass
class FactorEvaluationResult:
    factor_id: str
    evaluation_window: str
    active_tab: FactorEvalTab = FactorEvalTab.ICAnalysis
    metrics: FactorMetrics = field(default_factory=FactorMetrics)


@dataclass(frozen=True)
class FactorRow:
    id: str
    name: str
    formula: str
    category: str
    ic: float
    rank_ic: float
    long_short_return: float
    status: FactorStatus
