"""QuantForge 策略库"""

__version__ = "0.1.0"

from .combined.dual_ma import DualMAStrategy
from .combined.rsi import RSIStrategy
from .combined.bollinger_band import BollingerBandStrategy
from .combined.macd import MACDStrategy
from .combined.kdj import KDJStrategy
from .selectors.momentum import MomentumSelector
from .timers.ma_crossover import MACrossoverTiming
from .sizers.equal_weight import EqualWeightSizer
from .sizers.fixed_fraction import FixedFractionSizer
from .registry import register, get, list_all

# 自动注册内置策略
register("dual_ma", DualMAStrategy)
register("rsi", RSIStrategy)
register("bollinger_band", BollingerBandStrategy)
register("macd", MACDStrategy)
register("kdj", KDJStrategy)
register("momentum_selector", MomentumSelector)
register("ma_crossover", MACrossoverTiming)
register("equal_weight", EqualWeightSizer)
register("fixed_fraction", FixedFractionSizer)

__all__ = [
    "DualMAStrategy", "RSIStrategy", "BollingerBandStrategy",
    "MACDStrategy", "KDJStrategy",
    "MomentumSelector", "MACrossoverTiming",
    "EqualWeightSizer", "FixedFractionSizer",
    "register", "get", "list_all",
]
