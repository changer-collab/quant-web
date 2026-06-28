"""枚举类型 — 与 TS 侧 strategy-runtime 对齐"""

from enum import Enum


class OrderSide(str, Enum):
    Buy = "buy"
    Sell = "sell"


class OrderType(str, Enum):
    Market = "market"
    Limit = "limit"


class OrderStatus(str, Enum):
    Pending = "pending"
    Filled = "filled"
    Canceled = "canceled"
    Rejected = "rejected"


class StrategyState(str, Enum):
    Idle = "idle"
    Running = "running"
    Stopped = "stopped"
    Error = "error"


class ParamType(str, Enum):
    Number = "number"
    String = "string"
    Boolean = "boolean"
    Select = "select"


class TimeFrame(str, Enum):
    M1 = "1m"
    M5 = "5m"
    M15 = "15m"
    H1 = "1h"
    D1 = "1d"


class ResearchMode(str, Enum):
    Traditional = "traditional"
    HighFrequency = "highFrequency"
    AI = "ai"


class TaskStatus(str, Enum):
    Pending = "pending"
    Running = "running"
    Completed = "completed"
    Failed = "failed"
    Cancelled = "cancelled"


class TaskType(str, Enum):
    Backtest = "backtest"
    Training = "training"
    FactorCompute = "factorCompute"
    FactorEval = "factorEval"


class StrategyKind(str, Enum):
    """策略类型 — 区分选股、择时、仓位管理和组合策略"""
    Combined = "combined"      # 传统单策略（现有 Strategy 的默认类型）
    Select = "select"          # 选股策略
    Timing = "timing"          # 择时策略
    Position = "position"      # 仓位管理策略
    Composite = "composite"    # 组合策略


class Signal(str, Enum):
    """交易信号"""
    Buy = "buy"
    Sell = "sell"
    Hold = "hold"


class StrategyCategory(str, Enum):
    """策略分类 — 三级分类体系"""
    FACTOR_BASED = "factor_based"
    NON_FACTOR = "non_factor"
    TRANSITIONAL = "transitional"


class StrategySubcategory(str, Enum):
    """策略子分类"""
    # 因子型
    LINEAR_MULTI_FACTOR = "linear_multi_factor"
    NONLINEAR_FACTOR = "nonlinear_factor"
    ALTERNATIVE_DATA = "alternative_data"
    # 趋势类 — 非因子型
    TREND_CTA = "trend_cta"
    MEAN_REVERSION = "mean_reversion"
    ARBITRAGE = "arbitrage"
    HFT = "hft"
    # 宏观 — 非因子型
    MACRO_QUANTITATIVE = "macro_quantitative"
    # 事件驱动 — 非因子型
    EVENT_DRIVEN = "event_driven"
    # E2E AI — 非因子型
    E2E_AI_TIMESERIES = "e2e_ai_timeseries"
    # 过渡形态
    HYBRID_SENTIMENT = "hybrid_sentiment"
    HYBRID_IF = "hybrid_if"
