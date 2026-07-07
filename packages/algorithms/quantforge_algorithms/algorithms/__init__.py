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

# LightGBM 模块层不 import lightgbm 库（lightgbm 在 _import_lgbm 方法内延迟导入），
# 因此此处直接导入不会因未安装 lightgbm 而失败，无需 try/except。
from .lightgbm_impl import LightGBMAlgorithm
AlgorithmRegistry.register(LightGBMAlgorithm)

from .gnn_impl import GNNAlgorithm
AlgorithmRegistry.register(GNNAlgorithm)

__all__ = [
    "AlgorithmRegistry",
    "RandomForestAlgorithm",
    "GradientBoostingAlgorithm",
    "LogisticRegressionAlgorithm",
    "LightGBMAlgorithm",
    "GNNAlgorithm",
]
