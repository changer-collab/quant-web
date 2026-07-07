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

# LightGBM 延迟导入——注册时不强制安装 lightgbm，仅在实例化 train 时 import
try:
    from .lightgbm_impl import LightGBMAlgorithm
    AlgorithmRegistry.register(LightGBMAlgorithm)
except ImportError:
    pass

from .gnn_impl import GNNAlgorithm
AlgorithmRegistry.register(GNNAlgorithm)

__all__ = [
    "AlgorithmRegistry",
    "RandomForestAlgorithm",
    "GradientBoostingAlgorithm",
    "LogisticRegressionAlgorithm",
    "GNNAlgorithm",
]
