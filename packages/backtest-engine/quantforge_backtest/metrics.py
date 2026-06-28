"""回测指标计算"""

from __future__ import annotations

import math

from .types import BacktestMetrics, EquityPoint


def calc_metrics(
    equity_curve: list[EquityPoint],
    initial_cash: float,
    total_trades: int | None = None,
    trades: list | None = None,
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

    # 年化波动率
    annualized_volatility = std_dev * math.sqrt(252) if std_dev > 0 else 0.0

    # 下行偏差（只考虑负收益）
    negative_returns = [r for r in returns if r < 0]
    if negative_returns:
        down_variance = sum(r ** 2 for r in negative_returns) / len(returns)
        down_dev = math.sqrt(down_variance)
    else:
        down_dev = 0.0

    # 索提诺比率
    sortino_ratio = (avg_return / down_dev) * math.sqrt(252) if down_dev > 0 else 0.0

    # 最大回撤
    max_drawdown = 0.0
    peak = equity_curve[0].equity
    for point in equity_curve:
        if point.equity > peak:
            peak = point.equity
        drawdown = (peak - point.equity) / peak
        if drawdown > max_drawdown:
            max_drawdown = drawdown

    # 卡玛比率
    calmar_ratio = annualized_return / max_drawdown if max_drawdown > 0 else 0.0

    # 最大回撤持续天数（从峰值到新高的最长天数）
    max_drawdown_duration = 0
    current_drawdown_duration = 0
    current_peak = equity_curve[0].equity
    current_peak_index = 0
    for i, point in enumerate(equity_curve):
        if point.equity > current_peak:
            current_peak = point.equity
            # 峰值到新高之间的天数就是当前回撤持续天数
            duration = i - current_peak_index
            if duration > max_drawdown_duration:
                max_drawdown_duration = duration
            current_peak_index = i
    # 如果最后仍在回撤中，也计入
    final_duration = len(equity_curve) - 1 - current_peak_index
    if final_duration > max_drawdown_duration:
        max_drawdown_duration = final_duration

    # 胜率
    wins = sum(1 for r in returns if r > 0)
    win_rate = wins / len(returns) if returns else 0.0

    metrics = BacktestMetrics(
        total_return=round(total_return, 4),
        annualized_return=round(annualized_return, 4),
        sharpe_ratio=round(sharpe_ratio, 2),
        max_drawdown=round(max_drawdown, 4),
        win_rate=round(win_rate, 4),
        total_trades=total_trades if total_trades is not None else len(returns),
        sortino_ratio=round(sortino_ratio, 2),
        calmar_ratio=round(calmar_ratio, 2),
        annualized_volatility=round(annualized_volatility, 4),
        max_drawdown_duration=max_drawdown_duration,
    )

    return metrics


def calc_trade_stats(trades: list) -> dict[str, float]:
    """从交易列表计算交易级衍生统计

    通过 FIFO 匹配买卖交易（按 symbol 分组），计算每笔 round-trip 的盈亏和持仓天数。

    返回:
        dict with keys: profit_loss_ratio, avg_holding_days, max_single_profit, max_single_loss
    """
    if not trades:
        return {
            "profit_loss_ratio": 0.0,
            "avg_holding_days": 0.0,
            "max_single_profit": 0.0,
            "max_single_loss": 0.0,
        }

    # 按 symbol 分组，FIFO 匹配
    from collections import defaultdict
    from quantforge_strategy import OrderSide

    buy_queue: dict[str, list] = defaultdict(list)  # symbol → [Trade, ...]
    round_trips: list[dict] = []  # [{profit, holding_days}, ...]

    for trade in trades:
        symbol = trade.symbol
        if trade.side == OrderSide.Buy:
            buy_queue[symbol].append(trade)
        elif trade.side == OrderSide.Sell:
            if buy_queue[symbol]:
                buy_trade = buy_queue[symbol].pop(0)
                profit = (trade.price - buy_trade.price) * trade.quantity

                # 持仓天数
                ts_buy = buy_trade.timestamp
                ts_sell = trade.timestamp
                # 时间戳可能是毫秒（13位）或秒（10位）
                ms_per_day = 86400 * 1000 if ts_buy > 1e12 else 86400
                holding_days = (ts_sell - ts_buy) / ms_per_day if ts_sell > ts_buy else 0.0

                round_trips.append({
                    "profit": profit,
                    "holding_days": holding_days,
                })

    if not round_trips:
        return {
            "profit_loss_ratio": 0.0,
            "avg_holding_days": 0.0,
            "max_single_profit": 0.0,
            "max_single_loss": 0.0,
        }

    profits = [rt["profit"] for rt in round_trips]
    gains = [p for p in profits if p > 0]
    losses = [p for p in profits if p < 0]

    avg_gain = sum(gains) / len(gains) if gains else 0.0
    avg_loss = abs(sum(losses) / len(losses)) if losses else 0.0
    profit_loss_ratio = avg_gain / avg_loss if avg_loss > 0 else 0.0

    avg_holding_days = sum(rt["holding_days"] for rt in round_trips) / len(round_trips)
    max_single_profit = max(profits) if profits else 0.0
    max_single_loss = min(profits) if profits else 0.0

    return {
        "profit_loss_ratio": round(profit_loss_ratio, 2),
        "avg_holding_days": round(avg_holding_days, 1),
        "max_single_profit": round(max_single_profit, 2),
        "max_single_loss": round(max_single_loss, 2),
    }
