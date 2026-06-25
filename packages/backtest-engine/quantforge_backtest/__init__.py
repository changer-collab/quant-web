"""QuantForge 回测引擎"""

__version__ = "0.1.0"

from .types import (
    BacktestConfig, BacktestMetrics, BacktestResult, EquityPoint,
    DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE,
)
from .market_rules import MarketRules, ASHARE_RULES, NO_RULES
from .matcher import Matcher
from .portfolio import PortfolioManager
from .replay import BarReplay
from .metrics import calc_metrics, calc_trade_stats
from .runner import BacktestRunner
from .composite_impl import DefaultComposite
from .multi_runner import MultiSymbolRunner
from .multi_strategy_runner import MultiStrategyRunner
from .equity_stats import (
    DrawdownPoint, MonthlyReturn, AnnualReturn,
    compute_drawdown_curve, compute_period_returns,
)

__all__ = [
    "BacktestConfig", "BacktestMetrics", "BacktestResult", "EquityPoint",
    "DEFAULT_INITIAL_CASH", "DEFAULT_SLIPPAGE",
    "MarketRules", "ASHARE_RULES", "NO_RULES",
    "Matcher", "PortfolioManager", "BarReplay",
    "calc_metrics", "calc_trade_stats", "BacktestRunner",
    "DefaultComposite", "MultiSymbolRunner", "MultiStrategyRunner",
    "DrawdownPoint", "MonthlyReturn", "AnnualReturn",
    "compute_drawdown_curve", "compute_period_returns",
]
