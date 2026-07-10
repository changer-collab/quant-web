"""listModels 命令 — 输出已注册模型列表（NDJSON 事件流）

输出格式（每行一个 NDJSON event）：
  {"event":"result","data":[{id, algorithm, trainedAt, metrics, path}, ...]}
"""

from __future__ import annotations

from typing import Any


def run_list_models(params: dict, emit=None) -> dict:
    """扫描 data/models/ 目录，返回模型列表。

    Args:
        params: CLI 请求参数（本命令不使用）
        emit:   事件发送回调（本命令未使用，仅匹配通用签名）

    Returns:
        {"ok": True, "data": [{"id":..., "algorithm":..., "trainedAt":...,
                               "metrics":..., "path":...}, ...]}
    """
    from pathlib import Path

    models_dir = Path("data/models")
    if not models_dir.exists():
        return {"ok": True, "data": []}

    models: list[dict[str, Any]] = []
    for p in sorted(models_dir.glob("*.joblib")):
        try:
            import joblib
            payload = joblib.load(p)
            algorithm = (
                payload.get("algorithm")
                or (
                    payload.get("config", {}).get("algorithm")
                    if isinstance(payload.get("config"), dict)
                    else None
                )
                or "unknown"
            )
            trained_at = payload.get("trained_at", 0)
            metrics = payload.get("metrics", {})
        except Exception as e:
            # 单个文件加载失败不阻塞整体列表
            algorithm = "error"
            trained_at = 0
            metrics = {"error": str(e)}

        models.append({
            "id": p.stem,
            "algorithm": algorithm,
            "trainedAt": trained_at,
            "metrics": metrics,
            "path": str(p),
        })

    return {"ok": True, "data": models}
