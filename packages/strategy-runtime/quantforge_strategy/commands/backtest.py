"""回测命令"""

from __future__ import annotations

import dataclasses
from typing import Any, Callable

from quantforge_backtest import BacktestRunner, MultiSymbolRunner, DefaultComposite
from quantforge_backtest.market_rules import ASHARE_RULES
from quantforge_strategies import get as get_strategy
from quantforge_data import DataClient
from quantforge_strategy import TimeFrame


def run_backtest(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
    _emit = emit or (lambda *a, **kw: None)

    strategy_name = params.get("strategy")
    if not strategy_name:
        return {
            "ok": False,
            "error": {"code": "MISSING_STRATEGY", "message": "params.strategy is required"},
        }

    config = params.get("config", {})
    data_range = params.get("dataRange", {})

    db_path = data_range.get("dbPath", "data/quant.db")
    timeframe = TimeFrame(data_range.get("timeframe", "1d"))
    start_ts = data_range.get("startTs")
    end_ts = data_range.get("endTs")

    # 分支 1: 组合策略（多标的）
    if strategy_name == "composite":
        return _run_composite(config, data_range, db_path, timeframe, start_ts, end_ts, _emit)

    # 分支 2: 多标的传统策略
    symbols = data_range.get("symbols")
    if isinstance(symbols, list) and len(symbols) > 1:
        return _run_multi_symbol(strategy_name, config, symbols, db_path, timeframe, start_ts, end_ts, _emit)

    # 分支 3: 单标的传统策略（默认）
    symbol = data_range.get("symbol", "")
    return _run_single(strategy_name, config, symbol, db_path, timeframe, start_ts, end_ts, _emit)


def _build_strategy(name: str, params: dict[str, Any] | None = None):
    """从注册表获取策略类并实例化"""
    cls = get_strategy(name)
    if params:
        return cls(**params)
    return cls()


def _run_single(
    strategy_name: str,
    config: dict[str, Any],
    symbol: str,
    db_path: str,
    timeframe: TimeFrame,
    start_ts: int | None,
    end_ts: int | None,
    _emit: Callable[[str, dict], None],
) -> dict[str, Any]:
    _emit("log", {"level": "info", "message": f"Loading data for {symbol} {timeframe.value}"})
    _emit("log", {"level": "info", "message": f"Category: {config.get('category', 'unknown')}"})

    # 优先读 snapshotParams，降级 strategyParams（过渡兼容）
    snapshot_params = config.get("snapshotParams")
    strategy_params = config.get("strategyParams")
    params = snapshot_params if snapshot_params is not None else strategy_params
    strategy = _build_strategy(strategy_name, params)
    client = DataClient(db_path)
    bars = client.query_bars(symbol, timeframe, start_ts=start_ts, end_ts=end_ts)

    if not bars:
        return {"ok": False, "error": {"code": "NO_DATA", "message": f"No bars for {symbol} {timeframe.value}"}}

    total = len(bars)
    _emit("log", {"level": "info", "message": f"Loaded {total} bars, starting backtest"})

    runner = BacktestRunner(
        strategy, bars,
        initial_cash=config.get("initialCash"),
        slippage=config.get("slippage"),
        market_rules=ASHARE_RULES,
    )
    result = runner.run(on_progress=lambda i, t: _emit_progress(_emit, i, t))
    data = _result_to_dict(result)
    # 单标的回测暂不启用存活偏差过滤
    if "config" in data:
        data["config"]["enablePitFilter"] = False
    return {"ok": True, "data": data}


def _run_multi_symbol(
    strategy_name: str,
    config: dict[str, Any],
    symbols: list[str],
    db_path: str,
    timeframe: TimeFrame,
    start_ts: int | None,
    end_ts: int | None,
    _emit: Callable[[str, dict], None],
) -> dict[str, Any]:
    _emit("log", {"level": "info", "message": f"Loading data for {len(symbols)} symbols {timeframe.value}"})

    # 多标的回测使用 MultiSymbolRunner，但策略需是 CompositeStrategy
    # 传统策略多标的场景：为每个标的创建独立策略实例，通过 MultiStrategyRunner
    # 这里简化处理：多标的传统策略暂不支持，提示用户使用 composite
    return {
        "ok": False,
        "error": {
            "code": "UNSUPPORTED",
            "message": "多标的回测请使用组合策略（strategy='composite'），传统策略仅支持单标的",
        },
    }


def _run_composite(
    config: dict[str, Any],
    data_range: dict[str, Any],
    db_path: str,
    timeframe: TimeFrame,
    start_ts: int | None,
    end_ts: int | None,
    _emit: Callable[[str, dict], None],
) -> dict[str, Any]:
    # 先校验 symbols
    symbols = data_range.get("symbols", [])
    if not symbols:
        return {"ok": False, "error": {"code": "NO_SYMBOLS", "message": "组合策略需要 dataRange.symbols 数组"}}

    client = DataClient(db_path)

    # 存活偏差过滤：只让回测开始时间点已上市且未退市的标的参与
    if start_ts is not None:
        active = set(client.get_active_symbols(start_ts))
        filtered = [s for s in symbols if s in active]
        dropped = len(symbols) - len(filtered)
        if dropped:
            _emit("log", {"level": "info", "message": f"存活偏差过滤：排除了 {dropped} 个在回测开始时未上市/已退市的标的"})
        symbols = filtered
        if not symbols:
            return {"ok": False, "error": {"code": "NO_ACTIVE_SYMBOLS", "message": "所有标的在回测开始时均未上市或已退市"}}

    components = config.get("components", {})
    selector_cfg = components.get("selector", {})
    timer_cfg = components.get("timer", {})
    sizer_cfg = components.get("sizer", {})

    _emit("log", {"level": "info", "message": "Building composite strategy"})

    selector = _build_strategy(selector_cfg.get("name", ""), selector_cfg.get("params"))
    timer = _build_strategy(timer_cfg.get("name", ""), timer_cfg.get("params"))
    sizer = _build_strategy(sizer_cfg.get("name", ""), sizer_cfg.get("params"))

    strategy = DefaultComposite(selector=selector, timer=timer, sizer=sizer)

    # 加载多标的数据
    _emit("log", {"level": "info", "message": f"Loading data for {len(symbols)} symbols {timeframe.value}"})

    bars_by_symbol: dict[str, list] = {}
    for symbol in symbols:
        bars = client.query_bars(symbol, timeframe, start_ts=start_ts, end_ts=end_ts)
        if bars:
            bars_by_symbol[symbol] = bars
            _emit("log", {"level": "info", "message": f"  {symbol}: {len(bars)} bars"})

    if not bars_by_symbol:
        return {"ok": False, "error": {"code": "NO_DATA", "message": "所有标的均无数据"}}

    total_steps = sum(len(b) for b in bars_by_symbol.values())
    _emit("log", {"level": "info", "message": f"Loaded {total_steps} total bars, starting backtest"})

    runner = MultiSymbolRunner(
        strategy, bars_by_symbol,
        initial_cash=config.get("initialCash"),
        slippage=config.get("slippage"),
        market_rules=ASHARE_RULES,
    )
    result = runner.run(on_progress=lambda i, t: _emit_progress(_emit, i, t))
    data = _result_to_dict(result)
    if "config" in data:
        data["config"]["enablePitFilter"] = (start_ts is not None)
    return {"ok": True, "data": data}


def _emit_progress(emit: Callable[[str, dict], None], index: int, total: int) -> None:
    # 仅在每 10% 或最后一个 bar 时输出，避免日志过多
    percent = int((index + 1) / total * 100)
    if (percent > 0 and percent % 10 == 0) or index + 1 == total:
        emit("progress", {"percent": percent, "message": f"Processing bar {index + 1}/{total}"})


def _result_to_dict(result) -> dict[str, Any]:
    from quantforge_backtest import compute_drawdown_curve, compute_period_returns

    def _to_dict(obj):
        if dataclasses.is_dataclass(obj):
            return {_to_camel(f): _to_dict(getattr(obj, f)) for f in obj.__dataclass_fields__}
        if isinstance(obj, list):
            return [_to_dict(i) for i in obj]
        if isinstance(obj, (int, float, str, bool)) or obj is None:
            return obj
        if hasattr(obj, "value"):  # Enum
            return obj.value
        return str(obj)

    data = _to_dict(result)

    # 附加衍生统计（内部字段保持 snake_case 匹配前端 types.ts 约定）
    dd_curve = compute_drawdown_curve(result.equity_curve)
    monthly, annual = compute_period_returns(result.equity_curve)
    data["drawdownCurve"] = [
        {"timestamp": p.timestamp, "drawdown": p.drawdown} for p in dd_curve
    ]
    data["monthlyReturns"] = [
        {"year": m.year, "month": m.month, "return_pct": m.return_pct} for m in monthly
    ]
    data["annualReturns"] = [
        {"year": a.year, "return_pct": a.return_pct} for a in annual
    ]

    # 子权益归因序列化（subEquity → {symbol: [{timestamp, equity}...]})
    sub_equity = getattr(result, "sub_equity", None)
    if sub_equity:
        data["subEquity"] = {
            key: [{"timestamp": p.timestamp, "equity": p.equity} for p in pts]
            for key, pts in sub_equity.items()
        }

    return data


def _to_camel(snake: str) -> str:
    """snake_case → camelCase"""
    parts = snake.split("_")
    return parts[0] + "".join(p.title() for p in parts[1:])
