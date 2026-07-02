"""策略分类枚举测试"""

import pytest
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


def test_canonical_10_members():
    """验证所有 canonical 10 成员存在且值正确"""
    canonical_values = {
        "linear_multi_factor",
        "index_enhancement",
        "ml_nonlinear_factor",
        "trend_cta",
        "arbitrage",
        "hft_microstructure",
        "macro_quant",
        "event_driven",
        "e2e_ai_timeseries",
        "event_sentiment_factor",
    }
    members = {m.value for m in Sub}
    assert members == canonical_values, f"Expected exactly 10 canonical values, got {len(members)}"


def test_old_subcategory_members_removed():
    """旧 4 成员应不存在，访问触发 AttributeError"""
    with pytest.raises(AttributeError):
        _ = Sub.MEAN_REVERSION
    with pytest.raises(AttributeError):
        _ = Sub.TAIL_RISK_HEDGING
    with pytest.raises(AttributeError):
        _ = Sub.NONLINEAR_ML
    with pytest.raises(AttributeError):
        _ = Sub.HIGH_FREQUENCY


def test_renamed_subcategory_members():
    """HIGH_FREQUENCY→HFT_MICROSTRUCTURE, NONLINEAR_ML→ML_NONLINEAR_FACTOR"""
    assert Sub.HFT_MICROSTRUCTURE == "hft_microstructure"
    assert Sub.ML_NONLINEAR_FACTOR == "ml_nonlinear_factor"


def test_new_subcategory_members():
    """新增成员 INDEX_ENHANCEMENT / EVENT_SENTIMENT_FACTOR"""
    assert Sub.INDEX_ENHANCEMENT == "index_enhancement"
    assert Sub.EVENT_SENTIMENT_FACTOR == "event_sentiment_factor"


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
