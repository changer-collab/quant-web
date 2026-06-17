"""数据概览笔记构建器"""

from __future__ import annotations

from quantforge_data import DataClient


def build_data_overview(client: DataClient) -> str:
    try:
        symbols = client.list_symbols()
        instruments = client.list_instruments()
        inst_count = len(instruments)
    except Exception:
        symbols = []
        inst_count = 0

    bar_info = f"{', '.join(symbols[:5])} 等 {len(symbols)} 个标的" if symbols else "暂无数据"
    symbol_lines = "\n".join(f"- {s}" for s in symbols[:20]) if symbols else "暂无行情数据"

    return f"""---
tags: [quant/data, moc]
---

# 数据概览

## 子域一览

| 子域 | 状态 |
|------|------|
| 参考数据（reference） | 标的 {inst_count} 个 |
| L1 行情（market） | {bar_info} |
| L2 行情（l2） | 待查询 |
| 基本面（fundamental） | 待查询 |
| 资讯事件（event） | 待查询 |
| 数据质量（quality） | 待检查 |

## 参考数据

### 标的列表

{"共 " + str(inst_count) + " 个标的。详情见 [[数据/参考数据/标的列表]]" if inst_count > 0 else "暂无标的"}

## L1 行情

{symbol_lines}

---

*由 QuantForge obsidian-sync 自动生成*"""


def build_instrument_list(client: DataClient) -> str:
    try:
        instruments = client.list_instruments()
    except Exception:
        instruments = None

    if instruments is None or len(instruments) == 0:
        return "---\ntags: [quant/data, quant/instrument]\n---\n\n# 标的列表\n\n暂无数据。"

    rows = "\n".join(f"| {row['symbol']} | {row['name']} | {row['exchange']} |" for _, row in instruments.iterrows())
    return f"""---
tags: [quant/data, quant/instrument]
---

# 标的列表

共 {len(instruments)} 个标的。

| 代码 | 名称 | 交易所 |
|------|------|--------|
{rows}

---

*由 QuantForge obsidian-sync 自动生成*"""
