"""非因子型策略诊断 — 占位实现

返回全零的非因子诊断结果，包含空参数敏感度、信号质量零值、滑点压力 4 档。
真实算法在 story-20 中实现。
"""

from __future__ import annotations

from typing import Any, Callable


class DiagnosticsNonFactor:
    """非因子型策略诊断"""

    @staticmethod
    def run(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
        """运行非因子型诊断，返回占位结果

        参数:
            params: 诊断参数（含 configSnapshot、时间范围等）
            emit: NDJSON 事件发射器

        返回:
            stub 诊断结果 dict，type='non_factor'
        """
        _emit = emit or (lambda *a, **kw: None)
        _emit("log", {"level": "info", "message": "Running non-factor diagnostics (stub)"})

        return {
            "type": "non_factor",
            "param_sensitivity": [],
            "signal_quality": {
                "total_signals": 0,
                "win_rate": 0.0,
                "avg_holding_bars": 0.0,
                "profit_factor": 0.0,
                "max_consecutive_losses": 0,
            },
            "slippage_stress": [
                {"bps": 1, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
                {"bps": 3, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
                {"bps": 5, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
                {"bps": 10, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
            ],
        }
