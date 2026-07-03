"""listStrategies 命令 — 输出所有注册策略元数据列表（NDJSON 事件流）

输出格式（每行一个 NDJSON event）：
  {"event":"result","data":[<StrategyMeta>, ...]}

每个 StrategyMeta 用 camelCase 字段，params 子数组与 API mapMeta 输出一致。
"""

from __future__ import annotations

# canonical 分类集合（与 API types.ts StrategyCategory union 和
# StrategySubcategory union 严格对齐，不产生第二个真相来源）
_CANONICAL_CATEGORIES = {"factor_based", "non_factor", "transitional"}
_CANONICAL_SUBCATEGORIES = {
    "linear_multi_factor",
    "index_enhancement",
    "ml_nonlinear_factor",
    "trend_cta",
    "arbitrage",
    "hft_microstructure",
    "macro_quant",
    "event_driven",
    "e2e_ai_timeseries",
    "event_sentiment_factor",
}


def _camelize_params(params: list) -> list[dict]:
    """将 StrategyParamDef 列表转为 camelCase 字典列表（与 API mapMeta 输出一致）

    每个 param 输出：
      - name: str               (取自 p.key)
      - range: [number, number] (取自 p.min/max，缺省 0)
      - chartRelevant: bool     (取自 p.chart_relevant)
      - uiConstraints: [...] | None (子字段 camelCase)
    """
    result = []
    for p in params:
        uics = None
        if p.ui_constraints:
            uics = [
                {
                    "kind": uic.kind,
                    "targetField": uic.target_field,
                    "targetValue": uic.target_value,
                    "actionValue": uic.action_value,
                }
                for uic in p.ui_constraints
            ]
        result.append({
            "name": p.key,
            "range": [p.min or 0, p.max or 0],
            "chartRelevant": p.chart_relevant,
            "uiConstraints": uics,
        })
    return result


def run_list_strategies(params: dict, emit=None) -> dict:
    """列出所有注册策略的元数据列表

    Args:
        params: CLI 请求参数（本命令不使用）
        emit:   事件发送回调（本命令未使用，仅匹配通用签名）

    Returns:
        {"ok": True, "data": [<策略元数据>, ...]}
    """
    # 延迟导入策略包，避免 CLI --help 等场景引入下游依赖
    from quantforge_strategies.registry import list_all

    classes = list_all()
    strategies = []

    for name, cls in classes.items():
        try:
            instance = cls()
            meta = instance.meta
        except Exception:
            # 跳过无法实例化的策略
            continue

        cat = meta.category.value if meta.category else None
        sub = meta.subcategory.value if meta.subcategory else None

        workflow_ready = bool(
            cat in _CANONICAL_CATEGORIES
            and sub is not None
            and sub in _CANONICAL_SUBCATEGORIES
        )

        backtestable = callable(getattr(instance, "on_bar", None))

        strategies.append({
            "name": meta.name,
            "category": cat,
            "subcategory": sub,
            "version": meta.version,
            "description": meta.description,
            "workflowReady": workflow_ready,
            "backtestable": backtestable,
            "params": _camelize_params(meta.params),
        })

    return {"ok": True, "data": strategies}
