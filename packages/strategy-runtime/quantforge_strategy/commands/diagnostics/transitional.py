"""过渡形态策略诊断 — 占位实现

返回全零的过渡形态诊断结果。
真实算法在后续 story 中实现。
"""

from __future__ import annotations

from typing import Any, Callable


class DiagnosticsTransitional:
    """过渡形态策略诊断"""

    @staticmethod
    def run(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
        """运行过渡形态诊断，返回占位结果

        参数:
            params: 诊断参数（含 configSnapshot、时间范围等）
            emit: NDJSON 事件发射器

        返回:
            stub 诊断结果 dict，type='transitional'
        """
        _emit = emit or (lambda *a, **kw: None)
        _emit("log", {"level": "info", "message": "Running transitional diagnostics (stub)"})

        return {
            "type": "transitional",
            "ic_series": [],
            "layered_returns": {
                "Q1": [], "Q2": [], "Q3": [], "Q4": [], "Q5": [],
            },
            "correlation_matrix": [],
            "factor_labels": [],
            "summary": {
                "mean_ic": 0.0,
                "ic_std": 0.0,
                "ic_ir": 0.0,
                "mean_rank_ic": 0.0,
            },
        }
