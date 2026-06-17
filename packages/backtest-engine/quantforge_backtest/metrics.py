"""回测指标计算"""

from __future__ import annotations

import math

from .types import BacktestMetrics, EquityPoint


def calc_metrics(
    equity_curve: list[EquityPoint],
    initial_cash: float,
    total_trades: int | None = None,
) -> BacktestMetrics:
    if len(equity_curve) < 2:
        return BacktestMetrics(total_trades=total_trades or 0)

    final_equity = equity_curve[-1].equity
    total_return = (final_equity - initial_cash) / initial_cash

    # 日收益率序列
    returns: list[float] = []
    for i in range(1, len(equity_curve)):
        prev = equity_curve[i - 1].equity
        curr = equity_curve[i].equity
        returns.append((curr - prev) / prev)

    # 年化收益率（假设日频，252 个交易日）
    trading_days = len(equity_curve) - 1
    annualized_return = (1 + total_return) ** (252 / trading_days) - 1 if trading_days > 0 else 0.0

    # 夏普比率（无风险利率简化为 0）
    avg_return = sum(returns) / len(returns) if returns else 0.0
    variance = sum((r - avg_return) ** 2 for r in returns) / len(returns) if returns else 0.0
    std_dev = math.sqrt(variance)
    sharpe_ratio = (avg_return / std_dev) * math.sqrt(252) if std_dev > 0 else 0.0

    # 最大回撤
    max_drawdown = 0.0
    peak = equity_curve[0].equity
    for point in equity_curve:
        if point.equity > peak:
            peak = point.equity
        drawdown = (peak - point.equity) / peak
        if drawdown > max_drawdown:
            max_drawdown = drawdown

    # 胜率
    wins = sum(1 for r in returns if r > 0)
    win_rate = wins / len(returns) if returns else 0.0

    return BacktestMetrics(
        total_return=round(total_return, 4),
        annualized_return=round(annualized_return, 4),
        sharpe_ratio=round(sharpe_ratio, 2),
        max_drawdown=round(max_drawdown, 4),
        win_rate=round(win_rate, 4),
        total_trades=total_trades if total_trades is not None else len(returns),
    )
