"""算法注册表。"""

from __future__ import annotations

from ..types import AlgorithmMeta
from .base import Algorithm


class AlgorithmRegistry:
    """算法注册表——name → Algorithm 类映射。"""

    _registry: dict[str, type[Algorithm]] = {}

    @classmethod
    def register(cls, algorithm_cls: type[Algorithm]) -> None:
        instance = algorithm_cls()
        cls._registry[instance.meta.name] = algorithm_cls

    @classmethod
    def get(cls, name: str) -> Algorithm:
        if name not in cls._registry:
            raise KeyError(f"Algorithm '{name}' not registered")
        return cls._registry[name]()

    @classmethod
    def list_all(cls) -> list[AlgorithmMeta]:
        return [cls().meta for cls in cls._registry.values()]
