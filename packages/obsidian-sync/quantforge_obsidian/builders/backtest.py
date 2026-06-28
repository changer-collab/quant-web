"""回测报告笔记构建器"""

from __future__ import annotations

from datetime import date

from quantforge_backtest import BacktestResult


def build_backtest_overview(results: list[dict]) -> str:
    if not results:
        items = "暂无回测记录"
    else:
        items = "\n".join(f"- [[{r['name']}]]（{r['date']}）" for r in results)
    return f"""---
tags: [quant/backtest, moc]
---

# 回测概览

{items}

---

*由 QuantForge obsidian-sync 自动生成*"""


def build_backtest_report(strategy_name: str, symbol: str, result: BacktestResult) -> str:
    today = date.today().isoformat()
    m = result.metrics
    c = result.config

    def pct(v: float) -> str:
        return f"{v * 100:.2f}%"

    def pct_or_dash(v: float | None) -> str:
        if v is None:
            return "-"
        return f"{v * 100:.2f}%"

    def val_or_dash(v: float | None, fmt: str = ".4f") -> str:
        if v is None:
            return "-"
        return f"{v:{fmt}}"

    # 绩效指标（基础 + 扩展）
    perf_rows = [
        ("总收益率", pct(m.total_return)),
        ("年化收益率", pct(m.annualized_return)),
        ("夏普比率", f"{m.sharpe_ratio:.4f}"),
        ("最大回撤", pct(m.max_drawdown)),
        ("胜率", pct(m.win_rate)),
        ("总交易次数", str(m.total_trades)),
        ("索提诺比率", val_or_dash(m.sortino_ratio)),
        ("卡玛比率", val_or_dash(m.calmar_ratio)),
        ("年化波动率", val_or_dash(m.annualized_volatility)),
        ("最大回撤天数", str(m.max_drawdown_duration) if m.max_drawdown_duration else "-"),
        ("盈亏比", val_or_dash(m.profit_loss_ratio)),
        ("平均持仓天数", val_or_dash(m.avg_holding_days, ".2f")),
        ("单笔最大盈利", val_or_dash(m.max_single_profit)),
        ("单笔最大亏损", val_or_dash(m.max_single_loss)),
    ]

    # 权益曲线数据（等距采样最多 30 个点）
    equity_lines = []
    if result.equity_curve:
        eq_points = result.equity_curve
        step = max(1, len(eq_points) // 30)
        sampled = eq_points[::step]
        equity_lines.append("\n| 时间戳 | 净值 |")
        equity_lines.append("|--------|------|")
        for p in sampled:
            equity_lines.append(f"| {p.timestamp} | {p.equity:,.2f} |")

    # 交易记录（最多 20 条）
    trade_lines = []
    if result.trades:
        trade_lines.append("\n| # | 方向 | 进场时间 | 出场时间 | 进场价 | 出场价 | 盈亏 |")
        trade_lines.append("|---|------|---------|---------|--------|--------|------|")
        for i, t in enumerate(result.trades[:20]):
            pnl = t.pnl
            trade_lines.append(
                f"| {i+1} | {t.direction} | {t.entry_time} | {t.exit_time} | "
                f"{t.entry_price:.2f} | {t.exit_price:.2f} | "
                f"{pnl:+,.2f}" if pnl else "N/A"
            )

    return f"""---
type: backtest
strategy: {strategy_name}
symbol: {symbol}
date: {today}
tags: [quant/backtest]
---

# 回测报告：{strategy_name} on {symbol}

## 运行配置

| 配置项 | 值 |
|--------|-----|
| 标的 | {symbol} |
| 时间框架 | {c.timeframe} |
| 初始资金 | {c.initial_cash:,.0f} |
| 滑点 | {c.slippage} |
| 模式 | {c.mode} |

## 绩效指标

| 指标 | 值 |
|------|-----|
{chr(10).join(f"| {row[0]} | {row[1]} |" for row in perf_rows)}

## 权益曲线

共 {len(result.equity_curve)} 个采样点。
{'  '.join(equity_lines) if equity_lines else '（无数据）'}

## 成交记录

共 {len(result.trades)} 笔交易。
{'  '.join(trade_lines) if trade_lines else '（无记录）'}

---

*由 QuantForge obsidian-sync 自动生成*"""
