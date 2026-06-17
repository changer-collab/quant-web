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
