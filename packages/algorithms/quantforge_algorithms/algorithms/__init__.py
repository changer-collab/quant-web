"""算法实现子包——自动注册所有算法。"""

from .registry import AlgorithmRegistry
from .sklearn_impl import (
    RandomForestAlgorithm,
    GradientBoostingAlgorithm,
    LogisticRegressionAlgorithm,
)

AlgorithmRegistry.register(RandomForestAlgorithm)
AlgorithmRegistry.register(GradientBoostingAlgorithm)
AlgorithmRegistry.register(LogisticRegressionAlgorithm)

__all__ = [
    "AlgorithmRegistry",
    "RandomForestAlgorithm",
    "GradientBoostingAlgorithm",
    "LogisticRegressionAlgorithm",
]
