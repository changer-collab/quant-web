"""信号生成器注册表。"""

from __future__ import annotations

from ..types import SignalGeneratorMeta
from .base import SignalGenerator


class SignalGeneratorRegistry:
    """信号生成器注册表——name -> SignalGenerator 类映射。"""

    _registry: dict[str, type[SignalGenerator]] = {}

    @classmethod
    def register(cls, generator_cls: type[SignalGenerator]) -> None:
        instance = generator_cls()
        cls._registry[instance.meta.name] = generator_cls

    @classmethod
    def get(cls, name: str) -> SignalGenerator:
        if name not in cls._registry:
            raise KeyError(f"SignalGenerator '{name}' not registered")
        return cls._registry[name]()

    @classmethod
    def list_all(cls) -> list[SignalGeneratorMeta]:
        return [cls().meta for cls in cls._registry.values()]
