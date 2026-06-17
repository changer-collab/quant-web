"""策略结果"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .meta import StrategyMeta
from .order import Order, Trade


@dataclass
class StrategyResult:
    meta: StrategyMeta
    orders: list[Order] = field(default_factory=list)
    trades: list[Trade] = field(default_factory=list)
    custom_output: dict[str, Any] | None = None
