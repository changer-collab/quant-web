"""回测引擎类型定义"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from quantforge_strategy import TimeFrame, ResearchMode, Instrument


DEFAULT_INITIAL_CASH = 1_000_000
DEFAULT_SLIPPAGE = 0.0


@dataclass(frozen=True)
class BacktestConfig:
    strategy_name: str
    mode: ResearchMode
    instruments: list[Instrument] = field(default_factory=list)
    timeframe: TimeFrame = TimeFrame.D1
    start_date: int = 0
    end_date: int = 0
    initial_cash: float = DEFAULT_INITIAL_CASH
    slippage: float = DEFAULT_SLIPPAGE
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class BacktestMetrics:
    total_return: float = 0.0
    annualized_return: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0


@dataclass(frozen=True)
class EquityPoint:
    timestamp: int
    equity: float


@dataclass
class BacktestResult:
    config: BacktestConfig
    trades: list = field(default_factory=list)  # list[Trade]
    equity_curve: list = field(default_factory=list)  # list[EquityPoint]
    metrics: BacktestMetrics = field(default_factory=BacktestMetrics)
