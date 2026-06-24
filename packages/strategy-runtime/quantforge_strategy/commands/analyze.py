"""AI 报告分析命令 — 输入回测结果 dict，输出分析文本 dict

依赖 quantforge_ai.report_analysis.ReportAnalyzer（延迟导入）。
接口为纯 dict，不依赖 BacktestResult 等业务类型。
"""

from __future__ import annotations
from typing import Any, Callable


def run_analyze(params: dict, emit: Callable[[str, dict], None]) -> dict[str, Any]:
    """运行 AI 报告分析

    输入 params（dict，不依赖业务类型）:
      - config: dict（回测配置）
      - metrics: dict（回测指标）
      - strategyLogic: str（可选，策略逻辑描述）

    输出:
      {"ok": True, "data": {"analysis": {...}}}
    """
    from quantforge_ai.report_analysis import ReportAnalyzer

    analyzer = ReportAnalyzer()
    result = analyzer.analyze(params)

    return {"ok": True, "data": {"analysis": result}}
