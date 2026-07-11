"""QuantForge 算法资产层"""

__version__ = "0.1.0"

from .types import (
    ApplicationMode,
    AlgorithmMeta,
    HyperParamDef,
    TrainConfig,
    ModelMetrics,
    LabelType,
    ModelArtifact,
    MLSignal,
    SignalContext,
    SignalGeneratorMeta,
)
from .algorithms import AlgorithmRegistry
from .signal_generators import SignalGeneratorRegistry
from .templates import TemplateRegistry

__all__ = [
    "ApplicationMode",
    "AlgorithmMeta",
    "HyperParamDef",
    "TrainConfig",
    "ModelMetrics",
    "LabelType",
    "ModelArtifact",
    "MLSignal",
    "SignalContext",
    "SignalGeneratorMeta",
    "AlgorithmRegistry",
    "SignalGeneratorRegistry",
    "TemplateRegistry",
]
