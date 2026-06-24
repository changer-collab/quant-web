"""DeepSeek LLM 客户端 — OpenAI 兼容 API 调用封装

设计原则：
- 只负责 HTTP 调用和响应解析，不包含业务逻辑
- 调用失败抛出 LLMClientError，由调用方决定是否 fallback
- 输入/输出均为 str，不依赖任何业务类型
"""

from __future__ import annotations

import json

import httpx

from .config import LLMConfig


class LLMClientError(Exception):
    """LLM 调用失败"""


class LLMClient:
    """DeepSeek OpenAI-compatible API 客户端"""

    def __init__(self, config: LLMConfig | None = None):
        self._config = config or LLMConfig.from_env()

    @property
    def available(self) -> bool:
        return self._config.available

    def chat(self, system_prompt: str, user_prompt: str) -> str:
        """发送对话请求，返回模型文本响应

        Raises:
            LLMClientError: 调用失败（网络错误、认证失败、响应解析失败等）
        """
        if not self.available:
            raise LLMClientError("LLM 未配置：缺少 DEEPSEEK_API_KEY 环境变量")

        url = f"{self._config.base_url}/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._config.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": self._config.max_tokens,
            "temperature": self._config.temperature,
        }

        try:
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
        except httpx.HTTPStatusError as e:
            raise LLMClientError(f"API 返回错误 {e.response.status_code}: {e.response.text}") from e
        except httpx.RequestError as e:
            raise LLMClientError(f"网络请求失败: {e}") from e
        except (json.JSONDecodeError, KeyError) as e:
            raise LLMClientError(f"响应解析失败: {e}") from e

        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            raise LLMClientError(f"响应结构异常: {data}") from e
