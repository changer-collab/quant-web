"""因子笔记构建器"""

from __future__ import annotations

from quantforge_factor import FactorDefinition, FactorMetrics


def build_factor_overview(factors: list[FactorDefinition]) -> str:
    if not factors:
        return "---\ntags: [quant/factor, moc]\n---\n\n# 因子概览\n\n暂无因子。"

    categories: dict[str, list[FactorDefinition]] = {}
    for f in factors:
        categories.setdefault(f.category, []).append(f)

    sections = []
    for cat, items in categories.items():
        links = "\n".join(f"  - [[因子/{f.name}]] — {f.formula}" for f in items)
        sections.append(f"### {cat}\n{links}")

    return f"""---
tags: [quant/factor, moc]
---

# 因子概览

共 {len(factors)} 个因子。

{chr(10).join(chr(10).join(['']) for _ in [0]).join(sections)}

---

*由 QuantForge obsidian-sync 自动生成*"""


def build_factor_note(definition: FactorDefinition, metrics: FactorMetrics | None = None) -> str:
    metrics_section = ""
    if metrics:
        rows = [
            ("IC 均值", f"{metrics.ic:.4f}"),
            ("Rank IC 均值", f"{metrics.rank_ic:.4f}"),
            ("多空分组年化收益", f"{metrics.long_short_return:.4f}"),
            ("最大回撤", f"{metrics.max_drawdown:.4f}"),
            ("IC 胜率", f"{metrics.ic_win_rate:.4f}"),
            ("换手率", f"{metrics.turnover:.4f}"),
        ]
        table = "\n".join(f"| {label} | {val} |" for label, val in rows)
        metrics_section = f"\n## 评估指标\n\n| 指标 | 值 |\n|------|-----|\n{table}"

    modes = ", ".join(m.value for m in definition.modes)

    return f"""---
type: factor
category: {definition.category}
status: {definition.status.value}
version: {definition.version}
tags: [quant/factor]
---

# {definition.name}

## 基本信息

| 属性 | 值 |
|------|-----|
| ID | {definition.id} |
| 分类 | {definition.category} |
| 频率 | {definition.frequency.value} |
| 状态 | {definition.status.value} |
| 版本 | {definition.version} |
| 模式 | {modes} |

## 公式

```
{definition.formula}
```
{metrics_section}

---

*由 QuantForge obsidian-sync 自动生成*"""
