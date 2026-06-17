"""策略参数定义"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .types import ParamType, ResearchMode, StrategyKind


@dataclass(frozen=True)
class StrategyParamDef:
    key: str
    label: str
    type: ParamType
    default: Any = None
    min: float | None = None
    max: float | None = None
    options: list[str] | None = None


@dataclass(frozen=True)
class StrategyMeta:
    name: str
    description: str
    modes: list[ResearchMode]
    params: list[StrategyParamDef]
    version: str
    required_factors: list[str] | None = None
    kind: StrategyKind = StrategyKind.Combined
