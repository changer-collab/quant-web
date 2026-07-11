"""单算法预定义模板。"""

from __future__ import annotations

from quantforge_strategy import StrategyCategory, StrategySubcategory

from ..types import ApplicationMode
from .base import AlgorithmTemplate
from .registry import TemplateRegistry


LightGBMStockSelectionTemplate = AlgorithmTemplate(
    template_id="lightgbm_stock_selection",
    name="LightGBM 截面排序选股",
    application_mode=ApplicationMode.CROSS_SECTIONAL,
    algorithm="lightgbm",
    signal_generator="cross_sectional_rank",
    description="LightGBM 算法用于全票截面打分排序，输出 top_k 选股信号",
    hyper_param_overrides={"max_depth": 6, "learning_rate": 0.05, "n_estimators": 100},
    category_hint=StrategyCategory.FACTOR_BASED,
    subcategory_hint=StrategySubcategory.ML_NONLINEAR_FACTOR,
)

LightGBMTimingTemplate = AlgorithmTemplate(
    template_id="lightgbm_timing",
    name="LightGBM 个股择时",
    application_mode=ApplicationMode.TIME_SERIES,
    algorithm="lightgbm",
    signal_generator="time_series_classify",
    description="LightGBM 算法用于个股时序分类，输出买卖信号",
    hyper_param_overrides={"max_depth": 5, "learning_rate": 0.05, "n_estimators": 100},
    category_hint=StrategyCategory.NON_FACTOR,
    subcategory_hint=StrategySubcategory.E2E_AI_TIMESERIES,
)

RandomForestStockSelectionTemplate = AlgorithmTemplate(
    template_id="random_forest_stock_selection",
    name="随机森林截面选股",
    application_mode=ApplicationMode.CROSS_SECTIONAL,
    algorithm="random_forest",
    signal_generator="cross_sectional_rank",
    description="RandomForest 算法用于截面打分排序，输出 top_k 选股信号",
    hyper_param_overrides={"n_estimators": 100, "max_depth": 5},
    category_hint=StrategyCategory.FACTOR_BASED,
    subcategory_hint=StrategySubcategory.ML_NONLINEAR_FACTOR,
)

RandomForestTimingTemplate = AlgorithmTemplate(
    template_id="random_forest_timing",
    name="随机森林个股择时",
    application_mode=ApplicationMode.TIME_SERIES,
    algorithm="random_forest",
    signal_generator="time_series_classify",
    description="RandomForest 算法用于个股时序分类，输出买卖信号",
    hyper_param_overrides={"n_estimators": 100, "max_depth": 5},
    category_hint=StrategyCategory.NON_FACTOR,
    subcategory_hint=StrategySubcategory.E2E_AI_TIMESERIES,
)

TemplateRegistry.register_single(LightGBMStockSelectionTemplate)
TemplateRegistry.register_single(LightGBMTimingTemplate)
TemplateRegistry.register_single(RandomForestStockSelectionTemplate)
TemplateRegistry.register_single(RandomForestTimingTemplate)
