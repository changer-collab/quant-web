"""因子型策略诊断 — 占位实现

返回全零的因子诊断结果，包含空 IC 序列、5 组分层收益、空相关性矩阵。
真实算法在 story-19 中实现。
"""

from __future__ import annotations

from typing import Any, Callable


class DiagnosticsFactor:
    """因子型策略诊断"""

    @staticmethod
    def run(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
        """运行因子型诊断，返回占位结果

        参数:
            params: 诊断参数（含 configSnapshot、时间范围等）
            emit: NDJSON 事件发射器

        返回:
            stub 诊断结果 dict，type='factor_based'
        """
        _emit = emit or (lambda *a, **kw: None)
        _emit("log", {"level": "info", "message": "Running factor diagnostics (stub)"})

        return {
            "type": "factor_based",
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
