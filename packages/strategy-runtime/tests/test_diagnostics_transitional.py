"""过渡形态诊断算法测试 — 情感衰减曲线 / 目标因子映射 / 异常检测"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from quantforge_strategy.commands.diagnostics.transitional import DiagnosticsTransitional


# ========================================================================
# 辅助函数：生成合成 K 线数据
# ========================================================================

SEED = 42


def _make_synthetic_bars(
    n: int = 240,
    seed: int = SEED,
    include_timestamp: bool = True,
) -> pd.DataFrame:
    """生成合成 OHLCV K 线数据

    参数:
        n: K线数量（默认 240 ≈ 1 年交易日）
        seed: 随机种子
        include_timestamp: 是否包含 epoch 秒级时间戳列

    返回:
        DataFrame 含 symbol / timeframe / timestamp / open / high / low / close / volume
    """
    rng = np.random.default_rng(seed)

    # 基础价格序列：温和上涨趋势 + 随机游走
    returns = rng.normal(0.0005, 0.015, n)
    price = 100.0 * np.exp(np.cumsum(returns))

    # 模拟日内 OHLC
    opens = price * (1.0 + rng.normal(0, 0.003, n))
    closes = price * (1.0 + rng.normal(0, 0.002, n))
    highs = np.maximum(opens, closes) * (1.0 + np.abs(rng.normal(0, 0.002, n)))
    lows = np.minimum(opens, closes) * (1.0 - np.abs(rng.normal(0, 0.002, n)))
    volumes = rng.integers(1_000_000, 10_000_000, n)

    df = pd.DataFrame({
        "symbol": ["TEST"] * n,
        "timeframe": ["1d"] * n,
        "open": opens,
        "high": highs,
        "low": lows,
        "close": closes,
        "volume": volumes,
    })

    if include_timestamp:
        # 生成工作日日期 → epoch 秒级时间戳
        dates = pd.date_range("2025-01-01", periods=n, freq="B")
        df["timestamp"] = dates.astype(np.int64) // 10 ** 6

    return df


def _make_empty_bars() -> pd.DataFrame:
    """生成空 DataFrame（列齐全但0行）"""
    return pd.DataFrame(columns=[
        "symbol", "timeframe", "timestamp", "open", "high", "low", "close", "volume",
    ])


def _make_short_bars(n: int = 15) -> pd.DataFrame:
    """生成短序列（<30根，测试数据不足场景）"""
    return _make_synthetic_bars(n=n, seed=SEED)


def _make_config(
    half_life: int = 5,
    target_factor_pool: list[str] | None = None,
    data_source: str = "",
) -> dict:
    """生成 configSnapshot 参数字典"""
    # None → 默认 ["mom"]；空列表 → 显式空池
    pool = ["mom"] if target_factor_pool is None else target_factor_pool
    params: dict = {
        "sentiment_decay_half_life": half_life,
        "target_factor_pool": pool,
    }
    if data_source:
        params["dataSource"] = data_source
    return {
        "strategy": "test_strategy",
        "params": params,
    }


def _run_basic_diagnostics(
    n: int = 240,
    half_life: int = 5,
    target_factor_pool: list[str] | None = None,
    emit: callable | None = None,
) -> dict:
    """便捷函数：创建合成数据后调用 DiagnosticsTransitional.run()"""
    df = _make_synthetic_bars(n=n)
    params = {
        "_bars_df": df,
        "symbol": "TEST",
        "timeframe": "1d",
        "dataRange": {},
        "configSnapshot": _make_config(half_life, target_factor_pool),
    }
    return DiagnosticsTransitional.run(params, emit=emit)


# ========================================================================
# 测试类
# ========================================================================


class TestSentimentCurve:
    """情感衰减曲线验证"""

    def test_sentiment_curve_is_non_empty(self):
        """正常数据应产生非空情感曲线"""
        result = _run_basic_diagnostics(n=240)
        assert len(result["sentiment_curve"]) > 0, "情感曲线不应为空"

    def test_sentiment_curve_has_ts_and_score(self):
        """每个情感点含 ts 和 score"""
        result = _run_basic_diagnostics(n=240)
        for point in result["sentiment_curve"]:
            assert "ts" in point, "缺少 ts 字段"
            assert "score" in point, "缺少 score 字段"
            assert isinstance(point["ts"], int), f"ts 应为 int, 实际 {type(point['ts'])}"
            assert isinstance(point["score"], float), f"score 应为 float, 实际 {type(point['score'])}"

    def test_sentiment_curve_length_matches_bars(self):
        """情感曲线长度接近数据长度（首尾 NaN 跳过）"""
        result = _run_basic_diagnostics(n=240)
        assert len(result["sentiment_curve"]) >= 200, \
            f"大部分数据点应有情感得分, 实际 {len(result['sentiment_curve'])}"

    def test_sentiment_scores_are_clipped(self):
        """情感得分在 [-4, 4] 合理范围内（已被 clip(-3,3)）"""
        result = _run_basic_diagnostics(n=240)
        for point in result["sentiment_curve"]:
            assert -4.0 <= point["score"] <= 4.0, f"异常情感值: {point['score']}"

    def test_sentiment_curve_timestamps_ascending(self):
        """情感曲线时间戳递增"""
        result = _run_basic_diagnostics(n=240)
        curve = result["sentiment_curve"]
        if len(curve) >= 2:
            for i in range(1, len(curve)):
                assert curve[i]["ts"] >= curve[i - 1]["ts"], "时间戳应递增"


class TestDecayEffect:
    """衰减参数效果验证"""

    def test_fast_decay_differs_from_slow_decay(self):
        """half_life=3 与 half_life=10 产生不同的情感曲线"""
        result_fast = _run_basic_diagnostics(n=240, half_life=3)
        result_slow = _run_basic_diagnostics(n=240, half_life=10)

        scores_fast = [p["score"] for p in result_fast["sentiment_curve"]]
        scores_slow = [p["score"] for p in result_slow["sentiment_curve"]]

        if len(scores_fast) > 10 and len(scores_slow) > 10:
            std_fast = float(np.std(scores_fast))
            std_slow = float(np.std(scores_slow))
            # 不同 half_life 应产生不同的波动特性
            assert abs(std_fast - std_slow) > 0.001, \
                f"half_life=3 std({std_fast:.4f}) 应与 half_life=10 std({std_slow:.4f}) 不同"


class TestOutlierDetection:
    """异常检测验证"""

    def test_outlier_count_is_integer(self):
        """outlier_count 为非负整数"""
        result = _run_basic_diagnostics(n=240)
        assert isinstance(result["outlier_count"], int)
        assert result["outlier_count"] >= 0

    def test_outlier_count_is_reasonable(self):
        """正态分布下 3σ 准则 outlier 比例 ≈ 0.3%，数量应较小"""
        result = _run_basic_diagnostics(n=240)
        # 240 * 0.003 = 0.72, 加上随机波动应 < 10
        assert result["outlier_count"] < 20, \
            f"outlier 过多: {result['outlier_count']}（正常应 < 10）"


class TestMappingMetrics:
    """目标因子映射验证"""

    def test_mapping_metrics_is_dict(self):
        """mapping_metrics 为 dict"""
        result = _run_basic_diagnostics(n=240)
        assert isinstance(result["mapping_metrics"], dict)

    def test_mapping_metrics_contains_factor_ids(self):
        """mapping_metrics 的 key 为因子 ID"""
        result = _run_basic_diagnostics(n=240, target_factor_pool=["mom", "vol"])
        for key in result["mapping_metrics"]:
            assert isinstance(key, str)
            assert key in ("mom", "vol"), f"意外因子 ID: {key}"

    def test_mapping_correlation_values_in_range(self):
        """映射相关系数在 [-1, 1] 内"""
        result = _run_basic_diagnostics(n=240)
        for val in result["mapping_metrics"].values():
            assert isinstance(val, float), f"相关性应为 float, 实际 {type(val)}"
            assert -1.0 <= val <= 1.0, f"相关系数越界: {val}"

    def test_empty_factor_pool_returns_empty_dict(self):
        """空 target_factor_pool 返回空 dict"""
        result = _run_basic_diagnostics(n=240, target_factor_pool=[])
        assert result["mapping_metrics"] == {}

    def test_unknown_factor_skipped_gracefully(self):
        """未知因子 ID 被跳过，不崩溃"""
        result = _run_basic_diagnostics(n=240, target_factor_pool=["unknown_factor"])
        # 未知因子没有对应公式，被 _build_factor_defs 过滤
        assert isinstance(result["mapping_metrics"], dict)
        # 可能为空（因为未知因子被过滤）
        assert "unknown_factor" not in result["mapping_metrics"]


class TestValidation:
    """映射验证"""

    def test_validation_passed_is_bool(self):
        """validation_passed 为 bool"""
        result = _run_basic_diagnostics(n=240)
        assert isinstance(result["validation_passed"], bool)

    def test_empty_result_validation_false(self):
        """空结果时 validation_passed 为 False"""
        result = DiagnosticsTransitional.run({
            "_bars_df": _make_empty_bars(),
            "configSnapshot": _make_config(),
        })
        assert result["validation_passed"] is False


class TestEmit:
    """emit 事件验证"""

    def test_emit_called_with_log_events(self):
        """正常运行应 emit log 事件"""
        events: list[tuple[str, dict]] = []

        def _emit(event: str, data: dict):
            events.append((event, data))

        _run_basic_diagnostics(n=240, emit=_emit)
        log_events = [e for e in events if e[0] == "log"]
        assert len(log_events) >= 3, f"应至少 3 个 log 事件, 实际 {len(log_events)}"

    def test_empty_data_emits_warning(self):
        """数据不足时 emit warning"""
        events: list[tuple[str, dict]] = []

        def _emit(event: str, data: dict):
            events.append((event, data))

        DiagnosticsTransitional.run({
            "_bars_df": _make_empty_bars(),
            "configSnapshot": _make_config(),
            "symbol": "TEST",
        }, emit=_emit)

        warnings = [e for e in events if e[0] == "log" and e[1].get("level") == "warn"]
        assert len(warnings) >= 1, "应 emit 至少 1 个 warning"


class TestDataInsufficiency:
    """数据不足场景"""

    def test_no_data_returns_empty_result(self):
        """无数据时返回结构化空结果"""
        result = DiagnosticsTransitional.run({
            "_bars_df": _make_empty_bars(),
            "configSnapshot": _make_config(),
        })
        assert result["type"] == "transitional"
        assert result["sentiment_curve"] == []
        assert result["mapping_metrics"] == {}
        assert result["outlier_count"] == 0
        assert result["validation_passed"] is False

    def test_fewer_than_30_bars_returns_empty(self):
        """K线<30根时返回空结果"""
        result = DiagnosticsTransitional.run({
            "_bars_df": _make_short_bars(n=15),
            "configSnapshot": _make_config(),
        })
        assert result["type"] == "transitional"
        assert result["sentiment_curve"] == []
        assert result["mapping_metrics"] == {}

    def test_missing_close_column_returns_empty(self):
        """缺少 close 列时返回空结果"""
        df = pd.DataFrame({
            "symbol": ["TEST"] * 240,
            "timestamp": range(240),
            "open": np.ones(240) * 100,
            "volume": np.ones(240) * 1000000,
        })
        result = DiagnosticsTransitional.run({
            "_bars_df": df,
            "configSnapshot": _make_config(),
        })
        assert result["sentiment_curve"] == []
        assert result["outlier_count"] == 0

    def test_no_config_params_no_crash(self):
        """configSnapshot 缺失 params 时不崩溃，使用默认值"""
        result = DiagnosticsTransitional.run({
            "_bars_df": _make_synthetic_bars(n=240),
            "configSnapshot": {"strategy": "test"},
        })
        assert result["type"] == "transitional"
        assert len(result["sentiment_curve"]) > 0, "即使无 params 也应产生结果"

    def test_null_data_source_no_crash(self):
        """无 dataSource 时不崩溃，使用价格波动率代理"""
        result = DiagnosticsTransitional.run({
            "_bars_df": _make_synthetic_bars(n=240),
            "configSnapshot": _make_config(data_source=""),
        })
        assert result["type"] == "transitional"
        assert len(result["sentiment_curve"]) > 0
        # mapping 可能有或没有值，但不崩溃即可


class TestIntegration:
    """集成测试 — 路由正常"""

    def test_run_through_diagnostics_router(self):
        """通过 run_diagnostics 路由时 type 正确"""
        from quantforge_strategy.commands.diagnostics import run_diagnostics

        result = run_diagnostics({
            "category": "transitional",
            "_bars_df": _make_synthetic_bars(n=240),
            "configSnapshot": _make_config(),
        })
        assert result["ok"] is True
        data = result["data"]
        assert data["type"] == "transitional"
        assert "sentiment_curve" in data
        assert "mapping_metrics" in data
        assert "outlier_count" in data
        assert "validation_passed" in data

    def test_cli_diagnostics_transitional(self):
        """CLI 子进程 diagnostics transitional 命令不崩溃"""
        import json
        import subprocess
        import sys

        proc = subprocess.run(
            [sys.executable, "-m", "quantforge_strategy"],
            input=json.dumps({
                "command": "diagnostics",
                "strategy": "test_strategy",
                "category": "transitional",
            }),
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=10,
        )
        events = [json.loads(line) for line in proc.stdout.strip().split("\n") if line.strip()]
        result_event = next((e for e in events if e.get("event") == "result"), None)
        assert result_event is not None, f"没有 result 事件: {events}"
        data = result_event.get("data", {})
        assert data.get("type") == "transitional"
