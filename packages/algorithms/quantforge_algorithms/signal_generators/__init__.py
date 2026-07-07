"""信号生成器子包——自动注册所有生成器。"""

from .registry import SignalGeneratorRegistry
from .cross_sectional import CrossSectionalRankGenerator
from .time_series import TimeSeriesClassifyGenerator

SignalGeneratorRegistry.register(CrossSectionalRankGenerator)
SignalGeneratorRegistry.register(TimeSeriesClassifyGenerator)

__all__ = [
    "SignalGeneratorRegistry",
    "CrossSectionalRankGenerator",
    "TimeSeriesClassifyGenerator",
]
