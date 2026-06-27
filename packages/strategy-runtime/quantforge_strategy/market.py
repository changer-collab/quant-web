"""行情类型 — 与 TS data-center 对齐"""

from __future__ import annotations

from dataclasses import dataclass

from .types import TimeFrame


@dataclass(frozen=True)
class Bar:
    symbol: str
    timeframe: TimeFrame
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    limit_up: float | None = None
    limit_down: float | None = None
    is_suspended: bool = False

    @property
    def is_limit_up(self) -> bool:
        """是否接近涨停价。"""
        return self.limit_up is not None and self.close >= self.limit_up - 0.01

    @property
    def is_limit_down(self) -> bool:
        """是否接近跌停价。"""
        return self.limit_down is not None and self.close <= self.limit_down + 0.01


@dataclass(frozen=True)
class Tick:
    symbol: str
    timestamp: int
    price: float
    volume: float
    bid: float
    ask: float


@dataclass(frozen=True)
class Instrument:
    symbol: str
    name: str
    exchange: str
    lot_size: int
    price_tick: float


@dataclass(frozen=True)
class MarketEvent:
    type: str  # "bar" | "tick"
    data: Bar | Tick
