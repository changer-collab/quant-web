"""算法层核心类型契约。

类型归属：本文件是 algorithms 包的类型所有权中心。
TrainConfig/ModelMetrics/LabelType 从 ai-engine 迁移而来（扩展 application_mode 字段）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Literal


class ApplicationMode(str, Enum):
    """算法的应用模式——决定输入数据形态和信号生成器选择"""
    CROSS_SECTIONAL = "cross_sectional"
    TIME_SERIES = "time_series"
    GRAPH_EMBEDDING = "graph_embedding"


class LabelType(str, Enum):
    """标签类型（从 ai-engine 迁移）"""
    RETURN_BINARY = "returnBinary"
    RETURN_CONTINUOUS = "returnContinuous"


@dataclass(frozen=True)
class HyperParamDef:
    """超参定义（供前端表单生成）"""
    key: str
    label: str
    type: Literal["int", "float", "select", "bool"]
    default: Any
    range: tuple[float, float] | None = None
    options: list[str] | None = None
    description: str = ""


@dataclass(frozen=True)
class AlgorithmMeta:
    """算法元数据"""
    name: str
    supported_modes: list[ApplicationMode]
    hyper_param_defs: list[HyperParamDef]
    description: str
    version: str


@dataclass(frozen=True)
class TrainConfig:
    """训练配置（从 ai-engine 迁移并扩展 application_mode）"""
    algorithm: str
    application_mode: ApplicationMode
    label_type: LabelType = LabelType.RETURN_BINARY
    test_size: float = 0.2
    random_state: int = 42
    hyper_params: dict = field(default_factory=dict)


@dataclass(frozen=True)
class ModelMetrics:
    """训练指标（从 ai-engine 迁移）"""
    accuracy: float = 0.0
    precision: float = 0.0
    recall: float = 0.0
    f1: float = 0.0
    auc: float = 0.0


@dataclass
class ModelArtifact:
    """训练产物——算法层与信号生成器、策略层之间的契约对象。

    artifact_id 是后续模型注册表的索引键（当前阶段只生成 UUID，不持久化到 DB）。
    application_mode 从 TrainConfig.application_mode 复制，便于消费方直接读取。
    """
    artifact_id: str
    algorithm: str
    model: Any
    config: TrainConfig
    metrics: ModelMetrics
    feature_schema: list[str]
    application_mode: ApplicationMode
    trained_at: int
    artifact_path: str | None = None


@dataclass
class MLSignal:
    """算法层信号——策略层消费的统一信号。

    命名为 MLSignal 避免与 strategy-runtime 的 Signal 枚举（Buy/Sell/Hold）冲突。

    不同应用场景使用不同字段：
    - 截面排序：score（排序打分），symbol（标的），side=buy
    - 时序分类：probability（涨跌概率），symbol（标的），side 由 threshold 决定
    - 图嵌入：score（因子值），symbol（标的），side 不适用
    """
    timestamp: int
    symbol: str
    side: Literal["buy", "sell", "hold"]
    score: float | None = None
    probability: float | None = None
    reason: str = ""


@dataclass
class SignalContext:
    """信号生成上下文"""
    timestamp: int
    symbols: list[str]
    threshold: float | None = None
    top_k: int | None = None


@dataclass(frozen=True)
class SignalGeneratorMeta:
    """信号生成器元数据"""
    name: str
    supported_mode: ApplicationMode
    description: str
