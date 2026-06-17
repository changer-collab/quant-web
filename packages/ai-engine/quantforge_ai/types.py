"""AI 引擎类型定义"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class ModelType(str, Enum):
    RandomForest = "randomForest"
    GradientBoosting = "gradientBoosting"
    LogisticRegression = "logisticRegression"


class LabelType(str, Enum):
    ReturnBinary = "returnBinary"
    ReturnContinuous = "returnContinuous"


@dataclass(frozen=True)
class TrainConfig:
    model_type: ModelType = ModelType.RandomForest
    label_type: LabelType = LabelType.ReturnBinary
    test_size: float = 0.2
    random_state: int = 42
    hyper_params: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ModelMetrics:
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0
    auc: float = 0.0


@dataclass
class PredictionResult:
    predictions: list = field(default_factory=list)  # list[float]
    probabilities: list = field(default_factory=list)  # list[float] | None
    model_metrics: ModelMetrics = field(default_factory=ModelMetrics)
