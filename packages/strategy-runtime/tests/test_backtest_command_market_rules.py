"""回测 CLI 默认接入 A 股市场规则测试"""

from quantforge_strategy import Bar, TimeFrame
from quantforge_strategy.commands import backtest as backtest_cmd
from quantforge_backtest.market_rules import ASHARE_RULES


class FakeDataClient:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path

    def query_bars(self, symbol: str, timeframe: TimeFrame, start_ts=None, end_ts=None):
        return [
            Bar(
                symbol=symbol,
                timeframe=timeframe,
                timestamp=1,
                open=10.0,
                high=10.1,
                low=9.9,
                close=10.0,
                volume=1000,
            )
        ]

    def get_active_symbols(self, as_of_ts: int):
        # 模拟：所有 ".SZ" 后缀的为活跃，".SH" 后缀的为不活跃
        return ["600000"]


def test_run_single_defaults_to_ashare_rules(monkeypatch):
    captured: dict[str, object] = {}

    class FakeRunner:
        def __init__(self, strategy, bars, initial_cash=None, slippage=None, market_rules=None):
            captured["market_rules"] = market_rules

        def run(self, on_progress=None):
            return object()

    monkeypatch.setattr(backtest_cmd, "DataClient", FakeDataClient)
    monkeypatch.setattr(backtest_cmd, "BacktestRunner", FakeRunner)
    monkeypatch.setattr(backtest_cmd, "_build_strategy", lambda name, params=None: object())
    monkeypatch.setattr(backtest_cmd, "_result_to_dict", lambda result: {"sentinel": True})

    result = backtest_cmd._run_single(
        strategy_name="dual_ma",
        config={},
        symbol="600000",
        db_path="unused.db",
        timeframe=TimeFrame.D1,
        start_ts=None,
        end_ts=None,
        _emit=lambda *args: None,
    )

    assert result["ok"] is True
    assert captured["market_rules"] is ASHARE_RULES


def test_run_composite_defaults_to_ashare_rules(monkeypatch):
    captured: dict[str, object] = {}

    class FakeRunner:
        def __init__(self, strategy, bars, initial_cash=None, slippage=None, market_rules=None):
            captured["market_rules"] = market_rules
            captured["symbols"] = set(bars)

        def run(self, on_progress=None):
            return object()

    monkeypatch.setattr(backtest_cmd, "DataClient", FakeDataClient)
    monkeypatch.setattr(backtest_cmd, "MultiSymbolRunner", FakeRunner)
    monkeypatch.setattr(backtest_cmd, "_build_strategy", lambda name, params=None: object())
    monkeypatch.setattr(backtest_cmd, "_result_to_dict", lambda result: {"sentinel": True})

    result = backtest_cmd._run_composite(
        config={
            "components": {
                "selector": {"name": "selector"},
                "timer": {"name": "timer"},
                "sizer": {"name": "sizer"},
            },
        },
        data_range={"symbols": ["600000", "000001"]},
        db_path="unused.db",
        timeframe=TimeFrame.D1,
        start_ts=None,
        end_ts=None,
        _emit=lambda *args: None,
    )

    assert result["ok"] is True
    assert captured["symbols"] == {"600000", "000001"}
    assert captured["market_rules"] is ASHARE_RULES


def test_run_composite_applies_survivorship_bias_filter(monkeypatch):
    captured: dict[str, object] = {}

    class FakeRunner:
        def __init__(self, strategy, bars, initial_cash=None, slippage=None, market_rules=None):
            captured["market_rules"] = market_rules
            captured["symbols"] = set(bars)

        def run(self, on_progress=None):
            return object()

    monkeypatch.setattr(backtest_cmd, "DataClient", FakeDataClient)
    monkeypatch.setattr(backtest_cmd, "MultiSymbolRunner", FakeRunner)
    monkeypatch.setattr(backtest_cmd, "_build_strategy", lambda name, params=None: object())
    monkeypatch.setattr(backtest_cmd, "_result_to_dict", lambda result: {"sentinel": True})

    result = backtest_cmd._run_composite(
        config={
            "components": {
                "selector": {"name": "selector"},
                "timer": {"name": "timer"},
                "sizer": {"name": "sizer"},
            },
        },
        data_range={"symbols": ["600000", "000001"]},
        db_path="unused.db",
        timeframe=TimeFrame.D1,
        start_ts=1000,
        end_ts=None,
        _emit=lambda *args: None,
    )

    assert result["ok"] is True
    # FakeDataClient.get_active_symbols 只返回 "600000"
    assert captured["symbols"] == {"600000"}


def test_run_composite_returns_no_active_symbols_error(monkeypatch):
    class EmptyActiveFakeClient:
        def __init__(self, db_path):
            pass

        def query_bars(self, symbol, timeframe, start_ts=None, end_ts=None):
            return []

        def get_active_symbols(self, as_of_ts):
            return []

    monkeypatch.setattr(backtest_cmd, "DataClient", EmptyActiveFakeClient)
    monkeypatch.setattr(backtest_cmd, "_build_strategy", lambda name, params=None: object())

    result = backtest_cmd._run_composite(
        config={
            "components": {
                "selector": {"name": "selector"},
                "timer": {"name": "timer"},
                "sizer": {"name": "sizer"},
            },
        },
        data_range={"symbols": ["600000", "000001"]},
        db_path="unused.db",
        timeframe=TimeFrame.D1,
        start_ts=1000,
        end_ts=None,
        _emit=lambda *args: None,
    )

    assert result["ok"] is False
    assert result["error"]["code"] == "NO_ACTIVE_SYMBOLS"


def test_snapshot_params_priority(monkeypatch):
    """当同时存在 snapshotParams 和 strategyParams 时，优先使用 snapshotParams"""
    captured: dict[str, object] = {}

    def fake_build_strategy(name, params=None):
        captured["params"] = params
        return object()

    class FakeRunner:
        def __init__(self, strategy, bars, initial_cash=None, slippage=None, market_rules=None):
            pass

        def run(self, on_progress=None):
            return object()

    monkeypatch.setattr(backtest_cmd, "DataClient", FakeDataClient)
    monkeypatch.setattr(backtest_cmd, "BacktestRunner", FakeRunner)
    monkeypatch.setattr(backtest_cmd, "_build_strategy", fake_build_strategy)
    monkeypatch.setattr(backtest_cmd, "_result_to_dict", lambda result: {"sentinel": True})

    result = backtest_cmd._run_single(
        strategy_name="dual_ma",
        config={"snapshotParams": {"period": 5}, "strategyParams": {"period": 10}},
        symbol="600000",
        db_path="unused.db",
        timeframe=TimeFrame.D1,
        start_ts=None,
        end_ts=None,
        _emit=lambda *args: None,
    )

    assert result["ok"] is True
    assert captured["params"] == {"period": 5}, (
        f"snapshotParams 应优先于 strategyParams, got {captured['params']}"
    )


def test_strategy_params_fallback(monkeypatch):
    """当无 snapshotParams 但有 strategyParams 时，降级使用 strategyParams"""
    captured: dict[str, object] = {}

    def fake_build_strategy(name, params=None):
        captured["params"] = params
        return object()

    class FakeRunner:
        def __init__(self, strategy, bars, initial_cash=None, slippage=None, market_rules=None):
            pass

        def run(self, on_progress=None):
            return object()

    monkeypatch.setattr(backtest_cmd, "DataClient", FakeDataClient)
    monkeypatch.setattr(backtest_cmd, "BacktestRunner", FakeRunner)
    monkeypatch.setattr(backtest_cmd, "_build_strategy", fake_build_strategy)
    monkeypatch.setattr(backtest_cmd, "_result_to_dict", lambda result: {"sentinel": True})

    result = backtest_cmd._run_single(
        strategy_name="dual_ma",
        config={"strategyParams": {"period": 10}},
        symbol="600000",
        db_path="unused.db",
        timeframe=TimeFrame.D1,
        start_ts=None,
        end_ts=None,
        _emit=lambda *args: None,
    )

    assert result["ok"] is True
    assert captured["params"] == {"period": 10}, (
        f"无 snapshotParams 时应降级 strategyParams, got {captured['params']}"
    )


def test_no_params_default_construction(monkeypatch):
    """当无 snapshotParams 也无 strategyParams 时，策略默认构造（params=None）"""
    captured: dict[str, object] = {}

    def fake_build_strategy(name, params=None):
        captured["params"] = params
        return object()

    class FakeRunner:
        def __init__(self, strategy, bars, initial_cash=None, slippage=None, market_rules=None):
            pass

        def run(self, on_progress=None):
            return object()

    monkeypatch.setattr(backtest_cmd, "DataClient", FakeDataClient)
    monkeypatch.setattr(backtest_cmd, "BacktestRunner", FakeRunner)
    monkeypatch.setattr(backtest_cmd, "_build_strategy", fake_build_strategy)
    monkeypatch.setattr(backtest_cmd, "_result_to_dict", lambda result: {"sentinel": True})

    result = backtest_cmd._run_single(
        strategy_name="dual_ma",
        config={},
        symbol="600000",
        db_path="unused.db",
        timeframe=TimeFrame.D1,
        start_ts=None,
        end_ts=None,
        _emit=lambda *args: None,
    )

    assert result["ok"] is True
    assert captured["params"] is None, (
        f"无任何 params 时应传 None（默认构造）, got {captured['params']}"
    )


def test_run_composite_prefers_snapshot_params(monkeypatch, tmp_path):
    """组合策略回测应优先使用 snapshotParams 而非 components.*.params

    验证 _run_composite 通过 _resolve_params helper 读取每个 component 的
    snapshotParams（优先）或 params（降级），且无数据时返回 NO_DATA 不抛 KeyError。
    """
    from quantforge_strategy.commands.backtest import run_backtest
    from quantforge_strategy import TimeFrame

    # mock DataClient：构造不校验 db 路径，方法返回受控数据
    class _FakeClient:
        def __init__(self, db_path):
            pass

        def get_active_symbols(self, as_of_ts):
            return ["TEST1", "TEST2"]

        def query_bars(self, symbol, timeframe, start_ts=None, end_ts=None):
            return []

    import quantforge_strategy.commands.backtest as bt_mod
    monkeypatch.setattr(bt_mod, "DataClient", _FakeClient)

    # 捕获每个 component 实际收到的 params，验证 snapshotParams 优先
    captured: list[tuple[str, dict | None]] = []

    def fake_build(name, params=None):
        captured.append((name, params))
        return object()

    monkeypatch.setattr(bt_mod, "_build_strategy", fake_build)

    result = run_backtest({
        "strategy": "composite",
        "config": {
            "components": {
                "selector": {
                    "name": "ma_selector",
                    "snapshotParams": {"period": 10},
                    "params": {"period": 20},
                },
                "timer": {
                    "name": "threshold_timer",
                    "snapshotParams": {"threshold": 0.5},
                    "params": {"threshold": 0.3},
                },
                "sizer": {
                    "name": "fixed_sizer",
                    "snapshotParams": {"ratio": 0.2},
                    "params": {"ratio": 0.1},
                },
            },
        },
        "dataRange": {
            "dbPath": str(tmp_path / "test.db"),
            "timeframe": "1d",
            "symbols": ["TEST1", "TEST2"],
            "startTs": 1000000000,
        },
    })

    # 无数据时应返回 NO_DATA,但验证 snapshotParams 被读取不抛 KeyError
    assert result["ok"] is False
    assert result["error"]["code"] == "NO_DATA"
    # 三个 component 都应收到 snapshotParams 的值,而非 params
    assert captured == [
        ("ma_selector", {"period": 10}),
        ("threshold_timer", {"threshold": 0.5}),
        ("fixed_sizer", {"ratio": 0.2}),
    ], f"snapshotParams 应优先于 params, got {captured}"
