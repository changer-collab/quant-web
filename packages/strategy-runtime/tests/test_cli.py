"""CLI 入口测试 — NDJSON 事件流格式"""

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


def test_cli_unknown_command():
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input='{"command": "unknown"}',
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert error_event["error"]["code"] == "UNKNOWN_COMMAND"


def test_cli_invalid_json():
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input="not json",
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert error_event["error"]["code"] == "INVALID_JSON"


def test_cli_backtest_no_data():
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input=json.dumps({
            "command": "backtest",
            "strategy": "dual_ma",
            "dataRange": {"dbPath": "/nonexistent/db.sqlite", "symbol": "000001.SZ"},
        }),
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    # 应该有 log 事件和最终的 error 事件
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert "error" in error_event


def test_cli_empty_input():
    """空输入应返回 UNKNOWN_COMMAND"""
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input="",
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert error_event["error"]["code"] == "UNKNOWN_COMMAND"


def test_cli_backtest_unknown_strategy():
    """不存在的策略应返回 INTERNAL_ERROR"""
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input=json.dumps({
            "command": "backtest",
            "strategy": "nonexistent_strategy",
            "dataRange": {"dbPath": "data/quant.db", "symbol": "600519"},
        }),
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert error_event["error"]["code"] == "INTERNAL_ERROR"


def test_cli_emit_format():
    """验证 NDJSON 事件格式正确"""
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input='{"command": "unknown"}',
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    assert len(events) >= 1
    for event in events:
        assert "event" in event
        assert event["event"] in ("progress", "log", "result", "error")


def test_cli_composite_no_symbols():
    """组合策略未提供 symbols 应返回 NO_SYMBOLS 错误"""
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input=json.dumps({
            "command": "backtest",
            "strategy": "composite",
            "config": {
                "components": {
                    "selector": {"name": "momentum_selector"},
                    "timer": {"name": "ma_crossover"},
                    "sizer": {"name": "equal_weight"},
                },
            },
            "dataRange": {"dbPath": "data/quant.db"},
        }),
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert error_event["error"]["code"] == "NO_SYMBOLS"


def test_cli_composite_missing_components():
    """组合策略缺少 components 应返回 INTERNAL_ERROR（KeyError）"""
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input=json.dumps({
            "command": "backtest",
            "strategy": "composite",
            "dataRange": {"dbPath": "data/quant.db", "symbols": ["600519"]},
        }),
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert error_event["error"]["code"] == "INTERNAL_ERROR"


def test_cli_multi_symbol_traditional_unsupported():
    """传统策略多标的应返回 UNSUPPORTED 错误"""
    result = subprocess.run(
        [sys.executable, "-m", "quantforge_strategy"],
        input=json.dumps({
            "command": "backtest",
            "strategy": "dual_ma",
            "dataRange": {
                "dbPath": "data/quant.db",
                "symbols": ["600519", "000001"],
            },
        }),
        capture_output=True, text=True, encoding="utf-8", timeout=10,
    )
    events = _parse_ndjson(result.stdout)
    error_event = _find_event(events, "error")
    assert error_event is not None
    assert error_event["error"]["code"] == "UNSUPPORTED"
