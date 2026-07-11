"""AI 引擎类型定义——向后兼容 re-export。

本文件类型已迁移到 quantforge_algorithms.types，此处仅保留 re-export 兼容性。
PredictionResult 保留在 ai-engine（预测结果聚合，非算法层职责）。
"""

from __future__ import annotations

from dataclasses import dataclass, field

from quantforge_algorithms.types import (
    LabelType,
    ModelMetrics,
    TrainConfig,
)


class ModelType:
    """已废弃——使用 AlgorithmRegistry.get(algorithm_name) 替代。

    保留枚举值兼容旧代码引用，但训练应通过 AlgorithmRegistry 调度。
    """
    RandomForest = "randomForest"
    GradientBoosting = "gradientBoosting"
    LogisticRegression = "logisticRegression"


@dataclass
class PredictionResult:
    """预测结果聚合——ai-engine 特有，非算法层职责。"""
    predictions: list = field(default_factory=list)  # list[float]
    probabilities: list = field(default_factory=list)  # list[float] | None
    model_metrics: ModelMetrics = field(default_factory=ModelMetrics)


__all__ = ["ModelType", "LabelType", "TrainConfig", "ModelMetrics", "PredictionResult"]
