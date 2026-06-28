"""命令子包 — 延迟导入具体命令实现"""

from __future__ import annotations


def run_backtest(*args, **kwargs):
    from .backtest import run_backtest as _run_backtest

    return _run_backtest(*args, **kwargs)


def run_factor_eval(*args, **kwargs):
    from .factor_eval import run_factor_eval as _run_factor_eval

    return _run_factor_eval(*args, **kwargs)


def run_ai_train(*args, **kwargs):
    from .ai_train import run_ai_train as _run_ai_train

    return _run_ai_train(*args, **kwargs)


__all__ = ["run_backtest", "run_factor_eval", "run_ai_train"]
