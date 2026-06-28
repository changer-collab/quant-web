"""策略分类枚举测试"""

from quantforge_strategy import (
    StrategyMeta, StrategyCategory, StrategySubcategory,
    UIConstraint, StrategyParamDef, ParamType,
)
from quantforge_strategy.types import StrategyCategory as Cat, StrategySubcategory as Sub


def test_category_enum_values():
    assert Cat.FACTOR_BASED == "factor_based"
    assert Cat.NON_FACTOR == "non_factor"
    assert Cat.TRANSITIONAL == "transitional"


def test_subcategory_enum_values():
    assert Sub.TREND_CTA == "trend_cta"
    assert Sub.LINEAR_MULTI_FACTOR == "linear_multi_factor"
    assert Sub.E2E_AI_TIMESERIES == "e2e_ai_timeseries"


def test_default_category_is_non_factor():
    """向后兼容：未指定 category 时默认 NON_FACTOR"""
    meta = StrategyMeta(
        name="test",
        description="test",
        modes=[],
        params=[],
        version="0.1.0",
    )
    assert meta.category == StrategyCategory.NON_FACTOR


def test_factor_based_property():
    meta = StrategyMeta(
        name="test",
        description="test",
        modes=[],
        params=[],
        version="0.1.0",
        category=StrategyCategory.FACTOR_BASED,
    )
    assert meta.factor_based is True


def test_non_factor_based_property():
    meta = StrategyMeta(
        name="test",
        description="test",
        modes=[],
        params=[],
        version="0.1.0",
        category=StrategyCategory.NON_FACTOR,
    )
    assert meta.factor_based is False


def test_uiconstraint_four_fields():
    constraint = UIConstraint(
        kind="disable_when",
        target_field="long_period",
        target_value=20,
        action_value=None,
    )
    assert constraint.kind == "disable_when"
    assert constraint.target_field == "long_period"
    assert constraint.target_value == 20
    assert constraint.action_value is None


def test_param_def_chart_relevant():
    param = StrategyParamDef(
        key="short_period",
        label="短均线周期",
        type=ParamType.Number,
        default=5,
        chart_relevant=True,
    )
    assert param.chart_relevant is True


def test_param_def_ui_constraints():
    constraint = UIConstraint(
        kind="disable_when",
        target_field="long_period",
        target_value=0,
        action_value=None,
    )
    param = StrategyParamDef(
        key="short_period",
        label="短均线周期",
        type=ParamType.Number,
        default=5,
        chart_relevant=True,
        ui_constraints=[constraint],
    )
    assert param.ui_constraints is not None
    assert len(param.ui_constraints) == 1
    assert param.ui_constraints[0].kind == "disable_when"


def test_strategy_meta_with_subcategory():
    meta = StrategyMeta(
        name="test",
        description="test",
        modes=[],
        params=[],
        version="0.1.0",
        category=StrategyCategory.NON_FACTOR,
        subcategory=StrategySubcategory.TREND_CTA,
    )
    assert meta.subcategory == StrategySubcategory.TREND_CTA


def test_strategy_meta_category_and_subcategory_default():
    meta = StrategyMeta(
        name="test",
        description="test",
        modes=[],
        params=[],
        version="0.1.0",
    )
    assert meta.category == StrategyCategory.NON_FACTOR
    assert meta.subcategory is None
