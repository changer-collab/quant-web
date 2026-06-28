"""Obsidian 同步命令 — 将回测结果同步到 Obsidian vault"""

from __future__ import annotations

import os
from typing import Any, Callable


def run_sync_backtest(
    params: dict[str, Any],
    emit: Callable[[str, dict], None] | None = None,
) -> dict[str, Any]:
    """同步回测结果到 Obsidian vault

    参数:
      params.strategyName: 策略名称
      params.symbol: 标的代码
      params.backtestData: 回测结果数据（与 CLI backtest 命令输出格式一致）
    """
    _emit = emit or (lambda *a, **kw: None)

    strategy_name = params.get("strategyName", "")
    symbol = params.get("symbol", "")
    backtest_data = params.get("backtestData", {})

    if not strategy_name or not symbol:
        return {"ok": False, "error": {"code": "MISSING_PARAMS", "message": "strategyName and symbol are required"}}

    api_url = os.getenv("OBSIDIAN_API_URL")
    if not api_url:
        _emit("log", {"level": "info", "message": "OBSIDIAN_API_URL not set, skipping sync"})
        return {"ok": True, "data": {"skipped": True, "reason": "OBSIDIAN_API_URL not set"}}

    try:
        import asyncio
        from quantforge_obsidian import SyncService
        from quantforge_backtest import (
            BacktestResult, BacktestConfig, BacktestMetrics,
            EquityPoint, ResearchMode,
        )

        sync = SyncService(api_url)
        if not sync.enabled:
            return {"ok": True, "data": {"skipped": True, "reason": "SyncService not enabled"}}

        _emit("progress", {"percent": 50, "message": f"Syncing backtest result for {strategy_name} on {symbol}"})

        result = _dict_to_backtest_result(backtest_data)
        asyncio.run(sync.sync_backtest_result(strategy_name, symbol, result))

        _emit("progress", {"percent": 100, "message": "Sync complete"})
        return {"ok": True, "data": {"synced": True}}
    except Exception as e:
        _emit("log", {"level": "warn", "message": f"Sync failed: {e}"})
        return {"ok": True, "data": {"skipped": True, "reason": f"Sync failed: {e}"}}


def _dict_to_backtest_result(data: dict[str, Any]) -> Any:
    """将 camelCase dict 转回 BacktestResult dataclass"""
    from quantforge_backtest import (
        BacktestResult, BacktestConfig, BacktestMetrics, EquityPoint,
        DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE,
    )
    from quantforge_strategy import TimeFrame

    config_data = data.get("config", {})
    metrics_data = data.get("metrics", {})

    config = BacktestConfig(
        strategy_name=config_data.get("strategyName", ""),
        mode=ResearchMode(config_data.get("mode", "traditional")),
        timeframe=TimeFrame(config_data.get("timeframe", "1d")),
        start_date=config_data.get("startDate", 0),
        end_date=config_data.get("endDate", 0),
        initial_cash=config_data.get("initialCash", DEFAULT_INITIAL_CASH),
        slippage=config_data.get("slippage", DEFAULT_SLIPPAGE),
        strategy_kind=config_data.get("strategyKind", "combined"),
    )

    metrics = BacktestMetrics(
        total_return=metrics_data.get("totalReturn", 0),
        annualized_return=metrics_data.get("annualizedReturn", 0),
        sharpe_ratio=metrics_data.get("sharpeRatio", 0),
        max_drawdown=metrics_data.get("maxDrawdown", 0),
        win_rate=metrics_data.get("winRate", 0),
        total_trades=metrics_data.get("totalTrades", 0),
        sortino_ratio=metrics_data.get("sortinoRatio"),
        calmar_ratio=metrics_data.get("calmarRatio"),
        annualized_volatility=metrics_data.get("annualizedVolatility"),
        max_drawdown_duration=metrics_data.get("maxDrawdownDuration", 0),
        profit_loss_ratio=metrics_data.get("profitLossRatio"),
        avg_holding_days=metrics_data.get("avgHoldingDays"),
        max_single_profit=metrics_data.get("maxSingleProfit"),
        max_single_loss=metrics_data.get("maxSingleLoss"),
    )

    equity_curve = [
        EquityPoint(timestamp=p.get("timestamp", 0), equity=p.get("equity", 0))
        for p in data.get("equityCurve", [])
    ]

    trades = data.get("trades", [])

    return BacktestResult(config=config, metrics=metrics, equity_curve=equity_curve, trades=trades)
