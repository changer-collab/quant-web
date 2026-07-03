"""诊断命令 stub 测试 — 验证 CLI 注册 + category 路由 + 未知分类容错"""

import json
import subprocess
import sys

import pytest

from quantforge_strategy.commands.diagnostics import run_diagnostics


# ============================================================
# 单元测试 — 直接调用路由函数
# ============================================================

class TestRunDiagnosticsRouting:
    """验证 run_diagnostics 按 category 路由到正确的诊断类"""

    def test_factor_based_returns_correct_type(self):
        result = run_diagnostics({"category": "factor_based"})
        assert result["ok"] is True
        assert result["data"]["type"] == "factor_based"

    def test_non_factor_returns_correct_type(self):
        result = run_diagnostics({"category": "non_factor"})
        assert result["ok"] is True
        assert result["data"]["type"] == "non_factor"

    def test_transitional_returns_correct_type(self):
        result = run_diagnostics({"category": "transitional"})
        assert result["ok"] is True
        assert result["data"]["type"] == "transitional"

    def test_unknown_category_defaults_to_non_factor(self):
        """未知 category 不抛异常，默认返回 non_factor 结果"""
        result = run_diagnostics({"category": "unknown_category"})
        assert result["ok"] is True
        assert result["data"]["type"] == "non_factor"

    def test_missing_category_defaults_to_non_factor(self):
        """缺失 category 字段不抛异常，默认返回 non_factor 结果"""
        result = run_diagnostics({})
        assert result["ok"] is True
        assert result["data"]["type"] == "non_factor"

    def test_empty_category_defaults_to_non_factor(self):
        """空 category 不抛异常"""
        result = run_diagnostics({"category": ""})
        assert result["ok"] is True
        assert result["data"]["type"] == "non_factor"

    def test_factor_based_contains_expected_fields(self):
        result = run_diagnostics({"category": "factor_based"})
        assert result["ok"] is True
        data = result["data"]
        assert "ic_series" in data
        assert "layered_returns" in data
        assert "correlation_matrix" in data
        assert "factor_labels" in data
        assert "summary" in data
        assert list(data["layered_returns"].keys()) == ["Q1", "Q2", "Q3", "Q4", "Q5"]

    def test_non_factor_contains_expected_fields(self):
        result = run_diagnostics({"category": "non_factor"})
        assert result["ok"] is True
        data = result["data"]
        assert "param_sensitivity" in data
        assert "signal_quality" in data
        assert "slippage_stress" in data
        assert len(data["slippage_stress"]) == 4
        assert data["slippage_stress"][0]["bps"] == 1

    def test_emit_called_with_log_event(self):
        """验证非 None emit 被调用"""
        events = []

        def _emit(event: str, data: dict):
            events.append((event, data))

        run_diagnostics({"category": "factor_based"}, emit=_emit)
        assert any(e[0] == "log" for e in events)


# ============================================================
# 集成测试 — 通过 CLI 子进程验证
# ============================================================

class TestDiagnosticsCLI:
    """通过 subprocess 验证 CLI 完整链路"""

    @staticmethod
    def _run_diagnostics_cli(payload: dict) -> list[dict]:
        result = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps(payload),
            capture_output=True, text=True, encoding="utf-8", timeout=10,
        )
        lines = result.stdout.strip().split("\n")
        return [json.loads(line) for line in lines if line.strip()]

    def test_cli_diagnostics_command_registered(self):
        """验证 _COMMANDS 包含 diagnostics（非 UNKNOWN_COMMAND）"""
        events = self._run_diagnostics_cli({
            "command": "diagnostics",
            "strategy": "test_strategy",
            "category": "factor_based",
        })
        # 不应有 unknown command 错误
        error_event = next((e for e in events if e.get("event") == "error"), None)
        if error_event:
            assert error_event["error"]["code"] != "UNKNOWN_COMMAND", \
                f"diagnostics command not registered: {error_event}"

    def test_cli_diagnostics_factor_based(self):
        events = self._run_diagnostics_cli({
            "command": "diagnostics",
            "strategy": "test_strategy",
            "category": "factor_based",
        })
        result_event = next((e for e in events if e.get("event") == "result"), None)
        assert result_event is not None, f"No result event in {events}"
        data = result_event.get("data", {})
        assert data.get("type") == "factor_based"

    def test_cli_diagnostics_non_factor(self):
        events = self._run_diagnostics_cli({
            "command": "diagnostics",
            "strategy": "test_strategy",
            "category": "non_factor",
        })
        result_event = next((e for e in events if e.get("event") == "result"), None)
        assert result_event is not None
        data = result_event.get("data", {})
        assert data.get("type") == "non_factor"

    def test_cli_diagnostics_transitional(self):
        events = self._run_diagnostics_cli({
            "command": "diagnostics",
            "strategy": "test_strategy",
            "category": "transitional",
        })
        result_event = next((e for e in events if e.get("event") == "result"), None)
        assert result_event is not None
        data = result_event.get("data", {})
        assert data.get("type") == "transitional"

    def test_cli_unknown_category_does_not_crash(self):
        """未知 category 不导致 CLI 崩溃"""
        events = self._run_diagnostics_cli({
            "command": "diagnostics",
            "strategy": "test_strategy",
            "category": "bogus_category",
        })
        result_event = next((e for e in events if e.get("event") == "result"), None)
        assert result_event is not None, "CLI crashed on unknown category"
        # 应由 non_factor fallback 返回结果
        data = result_event.get("data", {})
        assert data.get("type") == "non_factor"
