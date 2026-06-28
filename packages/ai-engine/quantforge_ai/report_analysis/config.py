"""LLM 配置 — 从环境变量读取，不硬编码任何密钥"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class LLMConfig:
    api_key: str = ""
    base_url: str = "https://api.deepseek.com"
    model: str = "deepseek-v4-flash"
    max_tokens: int = 2048
    temperature: float = 0.3

    @classmethod
    def from_env(cls) -> LLMConfig:
        """从环境变量构建配置，api_key 为空则返回空配置（LLM 模式不可用）"""
        return cls(
            api_key=os.environ.get("DEEPSEEK_API_KEY", ""),
            base_url=os.environ.get("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
            model=os.environ.get("DEEPSEEK_MODEL", "deepseek-v4-flash"),
        )

    @property
    def available(self) -> bool:
        return bool(self.api_key)
