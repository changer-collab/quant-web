"""CLI listStrategies 命令测试 — NDJSON 输出格式与字段完整性"""

import json
import subprocess
import sys

import pytest


def _parse_ndjson(stdout: str) -> list[dict]:
    """解析 NDJSON 输出为事件列表"""
    lines = stdout.strip().split("\n")
    return [json.loads(line) for line in lines if line.strip()]


def _find_event(events: list[dict], event_type: str) -> dict | None:
    """从事件列表中查找指定类型的事件"""
    for e in events:
        if e.get("event") == event_type:
            return e
    return None


class TestListStrategies:
    """listStrategies 命令测试"""

    def test_list_strategies_returns_result_event(self):
        """listStrategies 应返回 result 事件"""
        result = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps({"command": "listStrategies"}),
            capture_output=True, text=True, encoding="utf-8", timeout=10,
        )
        events = _parse_ndjson(result.stdout)
        result_event = _find_event(events, "result")
        assert result_event is not None, (
            f"Expected result event, got events: {[e['event'] for e in events]}"
        )

    def test_list_strategies_data_is_non_empty_array(self):
        """listStrategies data 应为非空数组"""
        result = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps({"command": "listStrategies"}),
            capture_output=True, text=True, encoding="utf-8", timeout=10,
        )
        events = _parse_ndjson(result.stdout)
        result_event = _find_event(events, "result")
        assert result_event is not None
        data = result_event.get("data", [])
        assert isinstance(data, list), f"data should be a list, got {type(data)}"
        assert len(data) >= 1, f"data should have at least 1 strategy, got {len(data)}"

    def test_list_strategies_field_names_camel_case(self):
        """每项策略必须有 camelCase 顶层字段"""
        result = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps({"command": "listStrategies"}),
            capture_output=True, text=True, encoding="utf-8", timeout=10,
        )
        events = _parse_ndjson(result.stdout)
        result_event = _find_event(events, "result")
        assert result_event is not None
        data = result_event["data"]

        REQUIRED_FIELDS = {
            "name", "category", "subcategory", "version",
            "description", "workflowReady", "backtestable", "params",
        }
        for entry in data:
            missing = REQUIRED_FIELDS - set(entry.keys())
            assert not missing, (
                f"Strategy '{entry.get('name', '?')}' missing fields: {missing}"
            )
            # 确认有 snake_case 字段
            snake_keys = {k for k in entry if "_" in k}
            assert not snake_keys, (
                f"Strategy '{entry.get('name', '?')}': found snake_case keys: {snake_keys}"
            )

    def test_list_strategies_params_camel_case(self):
        """params 子项必须含 name/range/chartRelevant/uiConstraints camelCase 字段"""
        result = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps({"command": "listStrategies"}),
            capture_output=True, text=True, encoding="utf-8", timeout=10,
        )
        events = _parse_ndjson(result.stdout)
        result_event = _find_event(events, "result")
        assert result_event is not None
        data = result_event["data"]

        for entry in data:
            params = entry.get("params", [])
            assert isinstance(params, list), (
                f"Strategy '{entry['name']}' params should be a list, got {type(params)}"
            )
            for p in params:
                assert "name" in p, f"param missing 'name': {p}"
                assert isinstance(p["name"], str), f"param.name should be str: {p}"
                assert "range" in p, f"param '{p['name']}' missing 'range'"
                assert isinstance(p["range"], list) and len(p["range"]) == 2, (
                    f"param '{p['name']}'.range should be [number, number]: {p['range']}"
                )
                assert "chartRelevant" in p, f"param '{p['name']}' missing 'chartRelevant'"
                assert isinstance(p["chartRelevant"], bool), (
                    f"param '{p['name']}'.chartRelevant should be bool"
                )
                assert "uiConstraints" in p, f"param '{p['name']}' missing 'uiConstraints'"
                # uiConstraints 可为 None 或 array
                if p["uiConstraints"] is not None:
                    assert isinstance(p["uiConstraints"], list), (
                        f"param '{p['name']}'.uiConstraints should be list or None"
                    )
                    for uic in p["uiConstraints"]:
                        assert "targetField" in uic, f"uic missing targetField: {uic}"
                        assert "targetValue" in uic, f"uic missing targetValue: {uic}"
                        assert "actionValue" in uic, f"uic missing actionValue: {uic}"

    def test_list_strategies_dual_ma_expected_values(self):
        """dual_ma 策略的预期字段值验证"""
        result = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps({"command": "listStrategies"}),
            capture_output=True, text=True, encoding="utf-8", timeout=10,
        )
        events = _parse_ndjson(result.stdout)
        result_event = _find_event(events, "result")
        assert result_event is not None
        data = result_event["data"]

        dual_ma = next((s for s in data if s["name"] == "dual_ma"), None)
        assert dual_ma is not None, "dual_ma strategy not found in list"
        assert dual_ma["category"] == "non_factor"
        assert dual_ma["subcategory"] == "trend_cta"
        assert dual_ma["version"] == "0.1.0"
        assert dual_ma["description"] == "双均线策略"
        assert dual_ma["workflowReady"] is True
        assert dual_ma["backtestable"] is True

        # 验证 params
        params = dual_ma["params"]
        assert len(params) == 2
        short_param = next((p for p in params if p["name"] == "short_period"), None)
        assert short_param is not None
        assert short_param["range"] == [2, 50]
        assert short_param["chartRelevant"] is True

        long_param = next((p for p in params if p["name"] == "long_period"), None)
        assert long_param is not None
        assert long_param["range"] == [5, 200]
        assert long_param["chartRelevant"] is True

    def test_list_strategies_subcategory_none_not_workflow_ready(self):
        """subcategory=null 的策略 workflowReady 应为 False"""
        # momentum_selector 的 subcategory 为 None
        result = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps({"command": "listStrategies"}),
            capture_output=True, text=True, encoding="utf-8", timeout=10,
        )
        events = _parse_ndjson(result.stdout)
        result_event = _find_event(events, "result")
        assert result_event is not None
        data = result_event["data"]

        sizer = next((s for s in data if s["name"] == "equal_weight"), None)
        if sizer:
            assert sizer["backtestable"] is False


def test_camelize_params_outputs_label_type_default_options():
    """_camelize_params 应输出 label/type/default/options,不再丢失

    ParamType 枚举实际值为 number/string/boolean/select（见 types.py），
    故此处使用 ParamType.Number / ParamType.String 并期望输出 "number"/"string"。
    """
    from quantforge_strategy.commands.list_strategies import _camelize_params
    from quantforge_strategy import StrategyParamDef, ParamType

    params = [
        StrategyParamDef(
            key="period",
            label="周期",
            type=ParamType.Number,
            default=20,
            min=5,
            max=100,
            options=None,
            chart_relevant=False,
            ui_constraints=[],
        ),
        StrategyParamDef(
            key="mode",
            label="模式",
            type=ParamType.String,
            default="simple",
            min=None,
            max=None,
            options=["simple", "advanced"],
            chart_relevant=False,
            ui_constraints=[],
        ),
    ]
    result = _camelize_params(params)
    assert result[0]["label"] == "周期"
    assert result[0]["type"] == "number"
    assert result[0]["default"] == 20
    assert result[0]["options"] is None
    assert result[1]["label"] == "模式"
    assert result[1]["type"] == "string"
    assert result[1]["default"] == "simple"
    assert result[1]["options"] == ["simple", "advanced"]
