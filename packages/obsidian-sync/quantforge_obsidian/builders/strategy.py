"""策略笔记构建器"""

from __future__ import annotations

from quantforge_strategy import StrategyMeta


def build_strategy_overview(strategies: list[StrategyMeta]) -> str:
    items = "\n".join(
        f"- **{s.name}** — {s.description}（模式: {', '.join(m.value for m in s.modes)}）→ [[策略/{s.name}]]"
        for s in strategies
    )
    return f"""---
tags: [quant/strategy, moc]
---

# 策略概览

共 {len(strategies)} 个策略。

{items}

---

*由 QuantForge obsidian-sync 自动生成*"""


def build_strategy_note(meta: StrategyMeta) -> str:
    if meta.params:
        rows = []
        for p in meta.params:
            rng = f"[{p.min}, {p.max}]" if p.type.value == "number" and p.min is not None and p.max is not None else "-"
            rows.append(f"| {p.key} | {p.type.value} | {p.default} | {rng} |")
        params_table = "| 参数 | 类型 | 默认值 | 范围 |\n|------|------|--------|------|\n" + "\n".join(rows)
    else:
        params_table = "无"

    modes = ", ".join(m.value for m in meta.modes)

    required_factors = ""
    if meta.required_factors:
        links = "\n".join(f"- [[因子/{f}]]" for f in meta.required_factors)
        required_factors = f"\n\n## 依赖因子\n\n{links}"

    return f"""---
type: strategy
version: {meta.version}
modes: [{modes}]
tags: [quant/strategy]
---

# {meta.name}

## 描述

{meta.description}

## 参数

{params_table}

## 模式

{modes}{required_factors}

---

*由 QuantForge obsidian-sync 自动生成*"""
