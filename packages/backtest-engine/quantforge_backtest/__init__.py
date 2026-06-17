"""QuantForge 回测引擎"""

__version__ = "0.1.0"

from .types import (
    BacktestConfig, BacktestMetrics, BacktestResult, EquityPoint,
    DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE,
)
from .matcher import Matcher
from .portfolio import PortfolioManager
from .replay import BarReplay
from .metrics import calc_metrics
from .runner import BacktestRunner
from .composite_impl import DefaultComposite
from .multi_runner import MultiSymbolRunner
from .multi_strategy_runner import MultiStrategyRunner

__all__ = [
    "BacktestConfig", "BacktestMetrics", "BacktestResult", "EquityPoint",
    "DEFAULT_INITIAL_CASH", "DEFAULT_SLIPPAGE",
    "Matcher", "PortfolioManager", "BarReplay",
    "calc_metrics", "BacktestRunner",
    "DefaultComposite", "MultiSymbolRunner", "MultiStrategyRunner",
]
