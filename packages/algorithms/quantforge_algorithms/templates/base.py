"""预定义模板基类与类型。"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

import pandas as pd

from quantforge_strategy import StrategyCategory, StrategySubcategory

from ..types import ApplicationMode, MLSignal, SignalContext, TrainConfig


@dataclass(frozen=True)
class AlgorithmTemplate:
    """预定义单算法模板——固定算法+信号生成器+应用模式的组合。"""
    template_id: str
    name: str
    application_mode: ApplicationMode
    algorithm: str
    signal_generator: str
    description: str
    hyper_param_overrides: dict
    category_hint: StrategyCategory
    subcategory_hint: StrategySubcategory
    is_combo: bool = False


@dataclass
class ComboContext:
    """组合模板的执行上下文。"""
    base_features: pd.DataFrame
    graph_data: Any = None
    graph_labels: pd.Series = None
    rank_labels: pd.Series = None
    gnn_config: TrainConfig = None
    lgbm_config: TrainConfig = None
    signal_ctx: SignalContext = None


class ComboAlgorithmTemplate(ABC):
    """组合模板基类——多算法流水线，artifact 在步骤间传递。"""

    @property
    @abstractmethod
    def template_id(self) -> str: ...

    @property
    @abstractmethod
    def meta(self) -> AlgorithmTemplate: ...

    @abstractmethod
    def run(self, ctx: ComboContext) -> list[MLSignal]:
        """执行组合流水线，返回最终信号。"""
