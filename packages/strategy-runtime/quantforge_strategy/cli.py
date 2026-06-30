"""CLI 入口 — 读取 stdin JSON，分发到对应引擎，输出 stdout NDJSON 事件流

通信协议: stdin JSON → stdout NDJSON（每行一个 JSON 事件）

事件类型:
  progress  — 进度更新 {"event":"progress","percent":30,"message":"..."}
  log       — 运行日志 {"event":"log","level":"info","message":"..."}
  result    — 最终结果 {"event":"result","data":{...}}
  error     — 错误     {"event":"error","error":{"code":"...","message":"..."}}

注意：CLI 命令通过延迟导入加载下游包，strategy-runtime 本身不依赖它们。
运行 CLI 需要额外安装：quantforge-backtest, quantforge-factor, quantforge-ai,
quantforge-strategies, quantforge-data
"""

from __future__ import annotations

import json
import sys
from typing import Any

# 强制 stdout/stderr 使用 UTF-8，避免 Windows 中文环境下 pipe 乱码
if sys.stdout.encoding is not None and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding is not None and sys.stderr.encoding.lower() != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")


def emit(event: str, data: dict[str, Any]) -> None:
    """输出一行 NDJSON 事件到 stdout"""
    line = json.dumps({"event": event, **data}, ensure_ascii=False)
    sys.stdout.write(line + "\n")
    sys.stdout.flush()


def _output(data: dict) -> None:
    """将旧式 {ok, data/error} 格式转换为 NDJSON 事件"""
    if data.get("ok"):
        emit("result", {"data": data["data"]})
    else:
        emit("error", {"error": data.get("error", {"code": "UNKNOWN", "message": "Unknown error"})})


def _run_backtest(params: dict) -> dict:
    from .commands.backtest import run_backtest
    return run_backtest(params, emit=emit)


def _run_factor_eval(params: dict) -> dict:
    from .commands.factor_eval import run_factor_eval
    return run_factor_eval(params, emit=emit)


def _run_ai_train(params: dict) -> dict:
    from .commands.ai_train import run_ai_train
    return run_ai_train(params, emit=emit)


def _run_analyze(params: dict) -> dict:
    from .commands.analyze import run_analyze
    return run_analyze(params, emit=emit)


def _run_sync_backtest(params: dict) -> dict:
    from .commands.sync_backtest import run_sync_backtest
    return run_sync_backtest(params, emit=emit)


def _run_diagnostics(params: dict) -> dict:
    from .commands.diagnostics import run_diagnostics
    return run_diagnostics(params, emit=emit)


_COMMANDS = {
    "backtest": _run_backtest,
    "factorEval": _run_factor_eval,
    "aiTrain": _run_ai_train,
    "analyze": _run_analyze,
    "syncBacktest": _run_sync_backtest,
    "diagnostics": _run_diagnostics,
}


def main() -> None:
    try:
        raw = sys.stdin.read()
        request = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as e:
        emit("error", {"error": {"code": "INVALID_JSON", "message": str(e)}})
        return

    command = request.get("command", "")
    handler = _COMMANDS.get(command)
    if handler is None:
        emit("error", {"error": {"code": "UNKNOWN_COMMAND", "message": f"Unknown command: {command}"}})
        return

    try:
        result = handler(request)
        _output(result)
    except Exception as e:
        emit("error", {"error": {"code": "INTERNAL_ERROR", "message": str(e)}})


if __name__ == "__main__":
    main()
