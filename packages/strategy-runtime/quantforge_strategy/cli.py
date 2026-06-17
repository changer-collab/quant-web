"""CLI 入口 — 读取 stdin JSON，分发到对应引擎，输出 stdout JSON

注意：CLI 命令通过延迟导入加载下游包，strategy-runtime 本身不依赖它们。
运行 CLI 需要额外安装：quantforge-backtest, quantforge-factor, quantforge-ai,
quantforge-strategies, quantforge-data
"""

from __future__ import annotations

import json
import sys


def _run_backtest(params: dict) -> dict:
    from .commands.backtest import run_backtest
    return run_backtest(params)


def _run_factor_eval(params: dict) -> dict:
    from .commands.factor_eval import run_factor_eval
    return run_factor_eval(params)


def _run_ai_train(params: dict) -> dict:
    from .commands.ai_train import run_ai_train
    return run_ai_train(params)


_COMMANDS = {
    "backtest": _run_backtest,
    "factorEval": _run_factor_eval,
    "aiTrain": _run_ai_train,
}


def main() -> None:
    try:
        raw = sys.stdin.read()
        request = json.loads(raw) if raw.strip() else {}
    except json.JSONDecodeError as e:
        _output({"ok": False, "error": {"code": "INVALID_JSON", "message": str(e)}})
        return

    command = request.get("command", "")
    handler = _COMMANDS.get(command)
    if handler is None:
        _output({"ok": False, "error": {"code": "UNKNOWN_COMMAND", "message": f"Unknown command: {command}"}})
        return

    try:
        result = handler(request)
        _output(result)
    except Exception as e:
        _output({"ok": False, "error": {"code": "INTERNAL_ERROR", "message": str(e)}})


def _output(data: dict) -> None:
    sys.stdout.write(json.dumps(data, ensure_ascii=False) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
