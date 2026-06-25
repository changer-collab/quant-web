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
    # 是否启用 A 股市场规则（T+1、印花税、佣金等）
    # True 使用默认 ASHARE_RULES，False 不启用任何规则
    enable_market_rules: bool = False
    # 策略类型（来自 StrategyMeta.kind，用于前端按类型过滤报告模块）
    strategy_kind: str = "combined"


@dataclass(frozen=True)
class BacktestMetrics:
    total_return: float = 0.0
    annualized_return: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0
    win_rate: float = 0.0
    total_trades: int = 0
    # 新增衍生指标
    sortino_ratio: float = 0.0  # 索提诺比率（下行偏差）
    calmar_ratio: float = 0.0  # 卡玛比率（年化收益/最大回撤）
    annualized_volatility: float = 0.0  # 年化波动率
    max_drawdown_duration: int = 0  # 最大回撤持续天数（从峰值到新高的最长天数）


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
    # 交易级衍生统计
    profit_loss_ratio: float = 0.0  # 平均盈利/平均亏损
    avg_holding_days: float = 0.0  # 平均持仓天数
    max_single_profit: float = 0.0  # 单笔最大盈利
    max_single_loss: float = 0.0  # 单笔最大亏损
