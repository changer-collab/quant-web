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
