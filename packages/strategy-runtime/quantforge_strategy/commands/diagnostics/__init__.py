"""诊断子包 — 按策略分类执行诊断"""

from __future__ import annotations

from typing import Any, Callable


def run_diagnostics(params: dict[str, Any], emit: Callable[[str, dict], None] | None = None) -> dict[str, Any]:
    """运行策略诊断

    根据 params['category'] 值路由到对应的诊断实现：
      - 'factor_based'  → DiagnosticsFactor
      - 'non_factor'    → DiagnosticsNonFactor
      - 'transitional'  → DiagnosticsTransitional
      - 未知/缺失       → 默认返回 non_factor 结果（不崩溃）

    参数:
        params: dict
            - strategy: str — 策略名
            - category: str — 策略分类
            - configSnapshot: dict — 配置快照（可选）
            - symbol: str — 标的（可选）
            - timeframe: str — 时间周期（可选）
            - dataRange: dict — 时间范围（可选）
        emit: NDJSON 事件发射器

    返回:
        dict — 诊断结果，含 type 字段指示分类
    """
    _emit = emit or (lambda *a, **kw: None)

    category = params.get("category", "")

    try:
        if category == "factor_based":
            from .factor import DiagnosticsFactor
            diagnostics_result = DiagnosticsFactor.run(params, emit=_emit)
        elif category == "transitional":
            from .transitional import DiagnosticsTransitional
            diagnostics_result = DiagnosticsTransitional.run(params, emit=_emit)
        else:
            # 默认：non_factor（包括 category 缺失、空值、未知值都走此分支）
            from .non_factor import DiagnosticsNonFactor
            diagnostics_result = DiagnosticsNonFactor.run(params, emit=_emit)

        return {"ok": True, "data": diagnostics_result}
    except Exception as e:
        if _emit:
            _emit("error", {"error": {"code": "DIAGNOSTICS_ERROR", "message": str(e)}})
        return {"ok": False, "error": {"code": "DIAGNOSTICS_ERROR", "message": str(e)}}
