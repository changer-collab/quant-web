"""LLM 客户端测试"""

import json

import pytest
from unittest.mock import patch, MagicMock

from quantforge_ai.report_analysis.config import LLMConfig
from quantforge_ai.report_analysis.llm_client import LLMClient, LLMClientError


class TestLLMConfig:
    def test_from_env_with_key(self):
        with patch.dict("os.environ", {"DEEPSEEK_API_KEY": "sk-test"}):
            cfg = LLMConfig.from_env()
            assert cfg.api_key == "sk-test"
            assert cfg.base_url == "https://api.deepseek.com"
            assert cfg.model == "deepseek-v4-flash"

    def test_from_env_without_key(self):
        with patch.dict("os.environ", {}, clear=True):
            cfg = LLMConfig.from_env()
            assert cfg.api_key == ""
            assert cfg.available is False

    def test_custom_env(self):
        env = {
            "DEEPSEEK_API_KEY": "sk-custom",
            "DEEPSEEK_BASE_URL": "https://custom.api.com",
            "DEEPSEEK_MODEL": "deepseek-v4-pro",
        }
        with patch.dict("os.environ", env):
            cfg = LLMConfig.from_env()
            assert cfg.base_url == "https://custom.api.com"
            assert cfg.model == "deepseek-v4-pro"


class TestLLMClient:
    def test_unavailable_when_no_key(self):
        client = LLMClient(LLMConfig(api_key=""))
        assert client.available is False
        with pytest.raises(LLMClientError, match="缺少 DEEPSEEK_API_KEY"):
            client.chat("system", "user")

    def test_chat_success(self):
        config = LLMConfig(api_key="sk-test")
        client = LLMClient(config)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": '{"test": "ok"}'}}]
        }
        mock_resp.text = json.dumps(mock_resp.json.return_value, ensure_ascii=False)

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_resp
            result = client.chat("system", "user")
            assert result == '{"test": "ok"}'

    def test_chat_http_error(self):
        import httpx

        config = LLMConfig(api_key="sk-test")
        client = LLMClient(config)

        mock_resp = MagicMock()
        mock_resp.status_code = 401
        mock_resp.text = "Unauthorized"
        error = httpx.HTTPStatusError("401", request=MagicMock(), response=mock_resp)

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.side_effect = error
            with pytest.raises(LLMClientError, match="401"):
                client.chat("system", "user")

    def test_chat_network_error(self):
        import httpx

        config = LLMConfig(api_key="sk-test")
        client = LLMClient(config)

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.side_effect = httpx.ConnectError("connection refused")
            with pytest.raises(LLMClientError, match="网络请求失败"):
                client.chat("system", "user")

    def test_chat_returns_raw_text(self):
        """chat() 返回原始文本，不做 JSON 校验"""
        config = LLMConfig(api_key="sk-test")
        client = LLMClient(config)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "任何文本都可以"}}]
        }
        mock_resp.text = json.dumps(mock_resp.json.return_value, ensure_ascii=False)

        with patch("httpx.Client") as MockClient:
            instance = MockClient.return_value.__enter__.return_value
            instance.post.return_value = mock_resp
            result = client.chat("system", "user")
            assert result == "任何文本都可以"
