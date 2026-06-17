"""仪表盘笔记构建器"""

from __future__ import annotations

from datetime import date

from quantforge_strategy import StrategyMeta
from quantforge_factor import FactorDefinition


def build_dashboard(
    strategies: list[StrategyMeta],
    factors: list[FactorDefinition],
    backtest_count: int,
) -> str:
    strategy_links = "\n".join(f"- [[策略/{s.name}]]" for s in strategies) if strategies else "暂无策略"
    factor_links = "\n".join(f"- [[因子/{f.name}]]" for f in factors) if factors else "暂无因子"
    today = date.today().isoformat()

    return f"""---
tags: [quant/dashboard, moc]
---

# quant-web 研究仪表盘

## 快速导航

- [[策略/策略概览|策略概览]] — {len(strategies)} 个策略
- [[因子/因子概览|因子概览]] — {len(factors)} 个因子
- [[数据/数据概览|数据概览]] — 数据中心摘要
- [[回测报告/回测概览|回测概览]] — {backtest_count} 份报告

---

## 策略列表

{strategy_links}

## 因子列表

{factor_links}

## 回测报告

[[回测报告/回测概览|查看全部 {backtest_count} 份报告]]

---

*由 QuantForge obsidian-sync 自动生成，{today}*"""
