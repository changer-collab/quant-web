"""snake_case ↔ camelCase 序列化工具"""

from __future__ import annotations

import re
from typing import Any


def to_camel(name: str) -> str:
    """snake_case → camelCase"""
    parts = name.split("_")
    return parts[0] + "".join(p.capitalize() for p in parts[1:])


def to_snake(name: str) -> str:
    """camelCase → snake_case"""
    s1 = re.sub(r"([A-Z]+)([A-Z][a-z])", r"\1_\2", name)
    return re.sub(r"([a-z\d])([A-Z])", r"\1_\2", s1).lower()


def to_camel_dict(data: dict[str, Any]) -> dict[str, Any]:
    """递归将 dict 的 key 从 snake_case 转为 camelCase"""
    result: dict[str, Any] = {}
    for k, v in data.items():
        key = to_camel(k)
        if isinstance(v, dict):
            result[key] = to_camel_dict(v)
        elif isinstance(v, list):
            result[key] = [to_camel_dict(i) if isinstance(i, dict) else i for i in v]
        else:
            result[key] = v
    return result


def from_camel_dict(data: dict[str, Any]) -> dict[str, Any]:
    """递归将 dict 的 key 从 camelCase 转为 snake_case"""
    result: dict[str, Any] = {}
    for k, v in data.items():
        key = to_snake(k)
        if isinstance(v, dict):
            result[key] = from_camel_dict(v)
        elif isinstance(v, list):
            result[key] = [from_camel_dict(i) if isinstance(i, dict) else i for i in v]
        else:
            result[key] = v
    return result
