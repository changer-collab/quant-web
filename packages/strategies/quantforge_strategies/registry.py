"""策略注册表"""

from __future__ import annotations

from typing import Type, Union

from quantforge_strategy import (
    Strategy,
    SelectorStrategy,
    TimingStrategy,
    PositionStrategy,
    CompositeStrategy,
)

# 所有策略基类的联合类型 — 注册表可接受任意一种策略类
StrategyType = Type[
    Union[
        Strategy,
        SelectorStrategy,
        TimingStrategy,
        PositionStrategy,
        CompositeStrategy,
    ]
]

_registry: dict[str, StrategyType] = {}


def register(name: str, cls: StrategyType) -> None:
    _registry[name] = cls


def get(name: str) -> StrategyType:
    if name not in _registry:
        raise KeyError(f"Strategy '{name}' not found in registry")
    return _registry[name]


def list_all() -> dict[str, StrategyType]:
    return dict(_registry)
