"""策略参数定义"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .types import ParamType, ResearchMode, StrategyKind, StrategyCategory, StrategySubcategory


@dataclass(frozen=True)
class UIConstraint:
    kind: str  # "disable_when" | "require_when" | "set_default_when" | "range_when"
    target_field: str
    target_value: Any | None = None
    action_value: Any | None = None


@dataclass(frozen=True)
class StrategyParamDef:
    key: str
    label: str
    type: ParamType
    default: Any = None
    min: float | None = None
    max: float | None = None
    options: list[str] | None = None
    chart_relevant: bool = False
    ui_constraints: list[UIConstraint] | None = None


@dataclass(frozen=True)
class StrategyMeta:
    name: str
    description: str
    modes: list[ResearchMode]
    params: list[StrategyParamDef]
    version: str
    required_factors: list[str] | None = None
    kind: StrategyKind = StrategyKind.Combined
    category: StrategyCategory = StrategyCategory.NON_FACTOR
    subcategory: StrategySubcategory | None = None

    @property
    def factor_based(self) -> bool:
        return self.category == StrategyCategory.FACTOR_BASED
