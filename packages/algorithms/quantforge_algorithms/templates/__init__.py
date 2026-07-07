"""模板子包——自动注册所有模板。"""

from .registry import TemplateRegistry
from .single import (
    LightGBMStockSelectionTemplate,
    LightGBMTimingTemplate,
    RandomForestStockSelectionTemplate,
    RandomForestTimingTemplate,
)

__all__ = [
    "TemplateRegistry",
    "LightGBMStockSelectionTemplate",
    "LightGBMTimingTemplate",
    "RandomForestStockSelectionTemplate",
    "RandomForestTimingTemplate",
]
