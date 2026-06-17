"""构建器测试"""

from quantforge_strategy import StrategyMeta, StrategyParamDef, ParamType, ResearchMode
from quantforge_factor import FactorDefinition, FactorStatus
from quantforge_obsidian.builders.strategy import build_strategy_overview, build_strategy_note
from quantforge_obsidian.builders.factor import build_factor_overview, build_factor_note
from quantforge_obsidian.builders.dashboard import build_dashboard


def _make_meta() -> StrategyMeta:
    return StrategyMeta(
        name="dual_ma",
        description="双均线策略",
        modes=[ResearchMode.Traditional],
        params=[
            StrategyParamDef(key="short_period", label="短均线", type=ParamType.Number, default=5, min=2, max=50),
        ],
        version="0.1.0",
    )


def _make_factor() -> FactorDefinition:
    return FactorDefinition(
        id="momentum_5d", name="5日动量", formula="close/close.shift(5)-1",
        category="momentum", modes=[ResearchMode.Traditional],
        frequency=ResearchMode.Traditional and None or __import__("quantforge_strategy", fromlist=["TimeFrame"]).TimeFrame.D1,
        status=FactorStatus.Active,
    )


def test_build_strategy_overview():
    meta = _make_meta()
    md = build_strategy_overview([meta])
    assert "# 策略概览" in md
    assert "dual_ma" in md


def test_build_strategy_note():
    meta = _make_meta()
    md = build_strategy_note(meta)
    assert "# dual_ma" in md
    assert "双均线策略" in md
    assert "short_period" in md


def test_build_factor_overview():
    from quantforge_strategy import TimeFrame
    factor = FactorDefinition(
        id="momentum_5d", name="5日动量", formula="close/close.shift(5)-1",
        category="momentum", modes=[ResearchMode.Traditional],
        frequency=TimeFrame.D1, status=FactorStatus.Active,
    )
    md = build_factor_overview([factor])
    assert "# 因子概览" in md
    assert "5日动量" in md


def test_build_factor_note():
    from quantforge_strategy import TimeFrame
    factor = FactorDefinition(
        id="momentum_5d", name="5日动量", formula="close/close.shift(5)-1",
        category="momentum", modes=[ResearchMode.Traditional],
        frequency=TimeFrame.D1, status=FactorStatus.Active,
    )
    md = build_factor_note(factor)
    assert "# 5日动量" in md
    assert "momentum" in md


def test_build_dashboard():
    meta = _make_meta()
    from quantforge_strategy import TimeFrame
    factor = FactorDefinition(
        id="momentum_5d", name="5日动量", formula="close/close.shift(5)-1",
        category="momentum", modes=[ResearchMode.Traditional],
        frequency=TimeFrame.D1, status=FactorStatus.Active,
    )
    md = build_dashboard([meta], [factor], 3)
    assert "# quant-web 研究仪表盘" in md
    assert "3 份报告" in md
