"""信号生成器子包——自动注册所有生成器。"""

from .registry import SignalGeneratorRegistry
from .cross_sectional import CrossSectionalRankGenerator
from .time_series import TimeSeriesClassifyGenerator
from .graph_embedding import GraphEmbeddingGenerator

SignalGeneratorRegistry.register(CrossSectionalRankGenerator)
SignalGeneratorRegistry.register(TimeSeriesClassifyGenerator)
SignalGeneratorRegistry.register(GraphEmbeddingGenerator)

__all__ = [
    "SignalGeneratorRegistry",
    "CrossSectionalRankGenerator",
    "TimeSeriesClassifyGenerator",
    "GraphEmbeddingGenerator",
]
