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

# LightGBM 延迟导入——注册时不强制安装 lightgbm，仅在实例化 train 时 import。
# lightgbm_impl.py 模块层不 import lightgbm（仅在 _import_lgbm 方法内 import），
# 所以 from .lightgbm_impl import LightGBMAlgorithm 不会因 lightgbm 未安装而失败。
from .lightgbm_impl import LightGBMAlgorithm
AlgorithmRegistry.register(LightGBMAlgorithm)

__all__ = [
    "AlgorithmRegistry",
    "RandomForestAlgorithm",
    "GradientBoostingAlgorithm",
    "LogisticRegressionAlgorithm",
    "LightGBMAlgorithm",
]
