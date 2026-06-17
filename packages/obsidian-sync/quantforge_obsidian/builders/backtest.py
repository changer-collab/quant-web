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
| 总收益率 | {pct(m.total_return)} |
| 年化收益率 | {pct(m.annualized_return)} |
| 夏普比率 | {m.sharpe_ratio:.4f} |
| 最大回撤 | {pct(m.max_drawdown)} |
| 胜率 | {pct(m.win_rate)} |
| 总交易次数 | {m.total_trades} |

## 成交记录

共 {len(result.trades)} 笔交易。

## 权益曲线

共 {len(result.equity_curve)} 个采样点。

起始权益: {c.initial_cash:,.0f}
终了权益: {result.equity_curve[-1].equity:,.0f if result.equity_curve else '-'}

---

*由 QuantForge obsidian-sync 自动生成*"""
