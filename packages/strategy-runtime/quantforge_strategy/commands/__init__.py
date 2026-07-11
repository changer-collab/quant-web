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


def run_diagnostics(*args, **kwargs):
    from .diagnostics import run_diagnostics as _run_diagnostics

    return _run_diagnostics(*args, **kwargs)


def run_list_strategies(*args, **kwargs):
    from .list_strategies import run_list_strategies as _run_list_strategies

    return _run_list_strategies(*args, **kwargs)


def run_list_models(*args, **kwargs):
    from .list_models import run_list_models as _run_list_models

    return _run_list_models(*args, **kwargs)


__all__ = [
    "run_backtest", "run_factor_eval", "run_ai_train",
    "run_diagnostics", "run_list_strategies", "run_list_models",
]
