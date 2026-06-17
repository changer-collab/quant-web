"""QuantForge 策略运行时"""

__version__ = "0.1.0"

# re-export data-center 行情类型（供下游模块通过合法依赖链获取）
from .types import TimeFrame, ResearchMode
from .market import Bar, Tick, Instrument, MarketEvent

# order
from .types import OrderSide, OrderType, OrderStatus
from .order import Order, Trade, OrderRequest

# portfolio
from .portfolio import Position, Account

# param
from .types import ParamType
from .meta import StrategyParamDef, StrategyMeta

# task
from .types import TaskStatus, TaskType

# error
from .error import QuantError

# strategy runtime core
from .types import StrategyState
from .context import StrategyContext
from .result import StrategyResult
from .strategy import Strategy

# 分层策略基类
from .types import StrategyKind, Signal
from .selectors import SelectorStrategy
from .timers import TimingStrategy
from .sizers import PositionStrategy
from .composite import CompositeStrategy

# serialization
from .serialization import to_camel, to_snake, to_camel_dict, from_camel_dict

__all__ = [
    # 行情
    "TimeFrame", "ResearchMode", "Bar", "Tick", "Instrument", "MarketEvent",
    # 订单
    "OrderSide", "OrderType", "OrderStatus", "Order", "Trade", "OrderRequest",
    # 持仓
    "Position", "Account",
    # 参数
    "ParamType", "StrategyParamDef", "StrategyMeta",
    # 任务
    "TaskStatus", "TaskType",
    # 错误
    "QuantError",
    # 策略核心
    "StrategyState", "StrategyContext", "StrategyResult", "Strategy",
    # 分层策略
    "StrategyKind", "Signal",
    "SelectorStrategy", "TimingStrategy", "PositionStrategy", "CompositeStrategy",
    # 序列化
    "to_camel", "to_snake", "to_camel_dict", "from_camel_dict",
]
