"""QuantForge AI 引擎"""

__version__ = "0.1.0"

from .types import ModelType, LabelType, TrainConfig, ModelMetrics, PredictionResult
from .features import FeatureExtractor
from .model import TrainingOrchestrator, ModelTrainer

__all__ = [
    "ModelType", "LabelType", "TrainConfig", "ModelMetrics", "PredictionResult",
    "FeatureExtractor", "TrainingOrchestrator", "ModelTrainer",
]


def __getattr__(name):
    """惰性 re-export 已废弃的 AIPredictor——保留 `from quantforge_ai import AIPredictor` 兼容性。

    故意不在包顶层导入 predictor，避免 `import quantforge_ai` 即触发 DeprecationWarning，
    同时保证直接 `from quantforge_ai.predictor import AIPredictor` 时模块体执行并告警。
    """
    if name == "AIPredictor":
        from .predictor import AIPredictor as _AIPredictor

        return _AIPredictor
    raise AttributeError(f"module 'quantforge_ai' has no attribute {name!r}")
