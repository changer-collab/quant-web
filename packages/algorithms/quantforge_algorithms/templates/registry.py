"""模板注册表。"""

from __future__ import annotations

from .base import AlgorithmTemplate, ComboAlgorithmTemplate


class TemplateRegistry:
    """模板注册表——管理单算法模板和组合模板。"""

    _single: dict[str, AlgorithmTemplate] = {}
    _combo: dict[str, type[ComboAlgorithmTemplate]] = {}

    @classmethod
    def register_single(cls, template: AlgorithmTemplate) -> None:
        cls._single[template.template_id] = template

    @classmethod
    def register_combo(cls, combo_cls: type[ComboAlgorithmTemplate]) -> None:
        instance = combo_cls()
        cls._combo[instance.template_id] = combo_cls

    @classmethod
    def get(cls, template_id: str) -> AlgorithmTemplate | ComboAlgorithmTemplate:
        if template_id in cls._single:
            return cls._single[template_id]
        if template_id in cls._combo:
            return cls._combo[template_id]()
        raise KeyError(f"Template '{template_id}' not registered")

    @classmethod
    def list_all(cls) -> list[AlgorithmTemplate]:
        singles = list(cls._single.values())
        for combo_cls in cls._combo.values():
            singles.append(combo_cls().meta)
        return singles
