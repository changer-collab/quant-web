"""策略注册表测试"""

from quantforge_strategies import register, get, list_all, DualMAStrategy, RSIStrategy, AIPredictorStrategy


def test_builtin_registered():
    all_strategies = list_all()
    assert "dual_ma" in all_strategies
    assert "rsi" in all_strategies
    assert "ai_predictor" in all_strategies


def test_get_ai_predictor():
    cls = get("ai_predictor")
    assert cls is AIPredictorStrategy


def test_get():
    cls = get("dual_ma")
    assert cls is DualMAStrategy


def test_get_not_found():
    try:
        get("nonexistent")
        assert False, "should raise"
    except KeyError:
        pass


def test_register_custom():
    from quantforge_strategy import Strategy

    class CustomStrategy(Strategy):
        @property
        def meta(self): return None  # type: ignore
        @property
        def state(self): return None  # type: ignore
        def init(self, ctx): pass
        def on_bar(self, bar, ctx): pass
        def finish(self): return None  # type: ignore

    register("custom", CustomStrategy)
    assert get("custom") is CustomStrategy
