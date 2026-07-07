"""模板子包——自动注册所有模板。"""

from .registry import TemplateRegistry
from .single import (
    LightGBMStockSelectionTemplate,
    LightGBMTimingTemplate,
    RandomForestStockSelectionTemplate,
    RandomForestTimingTemplate,
)
from .gnn_lightgbm_combo import GNNLightGBMComboTemplate

TemplateRegistry.register_combo(GNNLightGBMComboTemplate)

__all__ = [
    "TemplateRegistry",
    "LightGBMStockSelectionTemplate",
    "LightGBMTimingTemplate",
    "RandomForestStockSelectionTemplate",
    "RandomForestTimingTemplate",
    "GNNLightGBMComboTemplate",
]
