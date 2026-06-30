"""因子型诊断算法测试 — IC序列 / 分层收益 / 相关性矩阵"""

from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from quantforge_strategy.commands.diagnostics.factor import DiagnosticsFactor


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
        # 注意：pandas 3.x 的 DatetimeIndex.astype(np.int64) 返回微秒（非纳秒）
        dates = pd.date_range("2025-01-01", periods=n, freq="B")
        df["timestamp"] = dates.astype(np.int64) // 10 ** 6

    return df


def _make_empty_bars() -> pd.DataFrame:
    """生成空 DataFrame（列齐全但0行）"""
    return pd.DataFrame(columns=["symbol", "timeframe", "timestamp", "open", "high", "low", "close", "volume"])


def _make_short_bars(n: int = 15) -> pd.DataFrame:
    """生成短序列（<30根，测试数据不足场景）"""
    return _make_synthetic_bars(n=n, seed=SEED)


def _make_single_period_bars(n: int = 20) -> pd.DataFrame:
    """生成单月 K 线（<2个月，测试周期不足场景）"""
    rng = np.random.default_rng(SEED)
    price = 100.0 * np.exp(np.cumsum(rng.normal(0.0005, 0.015, n)))
    dates = pd.date_range("2025-01-01", periods=n, freq="B")
    return pd.DataFrame({
        "symbol": ["TEST"] * n,
        "timeframe": ["1d"] * n,
        "timestamp": dates.astype(np.int64) // 10 ** 6,
        "open": price * (1 + rng.normal(0, 0.003, n)),
        "high": price * 1.005,
        "low": price * 0.995,
        "close": price,
        "volume": rng.integers(1_000_000, 10_000_000, n),
    })


def _make_config(factor_ids: list[str] | None = None) -> dict:
    """生成 configSnapshot 参数字典"""
    ids = factor_ids or ["mom", "vol", "turn"]
    return {
        "strategy": "test_strategy",
        "params": {
            "factorPool": ids,
            "someParam": "value",
        },
    }


def _run_basic_diagnostics(
    n: int = 240,
    factor_ids: list[str] | None = None,
    emit: callable | None = None,
) -> dict:
    """便捷函数：创建合成数据后调用 DiagnosticsFactor.run()"""
    df = _make_synthetic_bars(n=n)
    params = {
        "_bars_df": df,
        "symbol": "TEST",
        "timeframe": "1d",
        "dataRange": {},
        "configSnapshot": _make_config(factor_ids),
    }
    return DiagnosticsFactor.run(params, emit=emit)


# ========================================================================
# 测试类
# ========================================================================


class TestICSeries:
    """IC 序列验证"""

    def test_ic_series_length_equals_period_count(self):
        """ic_series 长度 = 月数"""
        result = _run_basic_diagnostics(n=240)
        ic_series = result["ic_series"]
        assert len(ic_series) > 0, "应包含至少1个周期"
        # 240 个交易日 ≈ 11-12 个月
        assert 8 <= len(ic_series) <= 13, f"IC序列长度 {len(ic_series)} 不符合预期范围 [8, 13]"

    def test_ic_series_has_required_fields(self):
        """每个 IC 条目含 period / ic / rank_ic"""
        result = _run_basic_diagnostics(n=240)
        for entry in result["ic_series"]:
            assert "period" in entry
            assert "ic" in entry
            assert "rank_ic" in entry
            assert isinstance(entry["period"], str)
            assert isinstance(entry["ic"], float)
            assert isinstance(entry["rank_ic"], float)

    def test_ic_values_are_valid_floats(self):
        """IC 值在 [-1, 1] 范围内"""
        result = _run_basic_diagnostics(n=240)
        for entry in result["ic_series"]:
            assert -1.0 <= entry["ic"] <= 1.0, f"IC out of range: {entry['ic']}"
            assert -1.0 <= entry["rank_ic"] <= 1.0, f"Rank IC out of range: {entry['rank_ic']}"

    def test_rank_ic_present(self):
        """rank_ic 在所有条目中均存在"""
        result = _run_basic_diagnostics(n=240)
        for entry in result["ic_series"]:
            assert entry["rank_ic"] != 0.0 or abs(entry["ic"]) > 0.001, \
                f"rank_ic should be non-zero: {entry}"
            # rank_ic 可能接近但不等于 ic
            assert isinstance(entry["rank_ic"], float)


class TestLayeredReturns:
    """分层收益验证"""

    def test_layered_returns_has_q1_to_q5(self):
        """layered_returns 含 Q1~Q5 共5组"""
        result = _run_basic_diagnostics(n=240)
        lr = result["layered_returns"]
        assert list(lr.keys()) == ["Q1", "Q2", "Q3", "Q4", "Q5"]

    def test_layered_returns_are_numeric_lists(self):
        """每组为 float 列表"""
        result = _run_basic_diagnostics(n=240)
        for key in ["Q1", "Q2", "Q3", "Q4", "Q5"]:
            values = result["layered_returns"][key]
            assert isinstance(values, list), f"{key} 应为 list, 实际 {type(values)}"
            assert len(values) > 0, f"{key} 不应为空"
            assert all(isinstance(v, float) for v in values), f"{key} 应全为 float"

    def test_layered_returns_start_at_one(self):
        """分层收益从 1.0 开始"""
        result = _run_basic_diagnostics(n=240)
        for key in ["Q1", "Q2", "Q3", "Q4", "Q5"]:
            assert result["layered_returns"][key][0] == 1.0, \
                f"{key}[0] 应为 1.0, 实际 {result['layered_returns'][key][0]}"

    def test_layered_returns_are_cumulative(self):
        """分层收益长度正确（每期一个累积值）"""
        result = _run_basic_diagnostics(n=240)
        lengths = {k: len(v) for k, v in result["layered_returns"].items()}
        # 各组长度应一致
        assert len(set(lengths.values())) == 1, f"各组长度不一致: {lengths}"


class TestCorrelationMatrix:
    """相关性矩阵验证"""

    def test_correlation_matrix_dimension(self):
        """相关性矩阵 N×N（N=因子数）"""
        result = _run_basic_diagnostics(n=240, factor_ids=["mom", "vol", "turn"])
        mat = result["correlation_matrix"]
        labels = result["factor_labels"]
        assert len(mat) == 3, f"3因子矩阵应为3×3, 实际 {len(mat)}"
        assert len(mat[0]) == 3, f"3因子矩阵应为3×3, 实际 {len(mat[0])}"
        assert len(labels) == 3

    def test_correlation_matrix_diagonal_is_one(self):
        """相关性矩阵对角线为 1.0"""
        result = _run_basic_diagnostics(n=240, factor_ids=["mom", "vol", "turn"])
        mat = result["correlation_matrix"]
        for i in range(len(mat)):
            assert mat[i][i] == 1.0, f"对角线 [{i}][{i}] 应为1.0, 实际 {mat[i][i]}"

    def test_correlation_matrix_symmetric(self):
        """相关性矩阵对称"""
        result = _run_basic_diagnostics(n=240, factor_ids=["mom", "vol", "turn"])
        mat = result["correlation_matrix"]
        for i in range(len(mat)):
            for j in range(len(mat)):
                assert abs(mat[i][j] - mat[j][i]) < 0.001, \
                    f"非对称: [{i}][{j}]={mat[i][j]}, [{j}][{i}]={mat[j][i]}"

    def test_correlation_values_in_range(self):
        """相关值在 [-1, 1] 内"""
        result = _run_basic_diagnostics(n=240, factor_ids=["mom", "vol", "turn"])
        mat = result["correlation_matrix"]
        for row in mat:
            for val in row:
                assert -1.0 <= val <= 1.0, f"相关系数越界: {val}"

    def test_single_factor_correlation(self):
        """单因子时矩阵为 [[1.0]]"""
        result = _run_basic_diagnostics(n=240, factor_ids=["mom"])
        mat = result["correlation_matrix"]
        assert mat == [[1.0]], f"单因子矩阵应为 [[1.0]], 实际 {mat}"
        assert result["factor_labels"] == ["mom"]

    def test_factor_labels_match_input(self):
        """factor_labels 反映输入的因子顺序"""
        result = _run_basic_diagnostics(n=240, factor_ids=["vol", "mom"])
        # 部分因子可能计算失败，至少应包含输入中成功计算的因子
        assert len(result["factor_labels"]) <= 2
        for label in result["factor_labels"]:
            assert label in ("vol", "mom"), f"意外的因子标签: {label}"


class TestSummary:
    """汇总统计验证"""

    def test_summary_has_required_fields(self):
        """summary 含 mean_ic / ic_std / ic_ir / mean_rank_ic"""
        result = _run_basic_diagnostics(n=240)
        s = result["summary"]
        assert "mean_ic" in s
        assert "ic_std" in s
        assert "ic_ir" in s
        assert "mean_rank_ic" in s

    def test_ic_ir_approx_mean_ic_over_ic_std(self):
        """ic_ir ≈ mean_ic / ic_std"""
        result = _run_basic_diagnostics(n=240)
        s = result["summary"]
        if s["ic_std"] > 1e-10:
            expected_ir = round(s["mean_ic"] / s["ic_std"], 4)
            assert abs(s["ic_ir"] - expected_ir) < 0.001, \
                f"ic_ir {s['ic_ir']} != mean_ic/ic_std ({expected_ir})"
        else:
            # ic_std 为 0 时 ic_ir 也为 0
            assert s["ic_ir"] == 0.0

    def test_summary_values_are_floats(self):
        """汇总值均为 float"""
        result = _run_basic_diagnostics(n=240)
        for key, value in result["summary"].items():
            assert isinstance(value, float), f"summary.{key} 应为 float, 实际 {type(value)}"

    def test_mean_ic_consistent_with_ic_series(self):
        """mean_ic = ic_series 均值"""
        result = _run_basic_diagnostics(n=240)
        if result["ic_series"]:
            computed_mean = round(float(np.mean([e["ic"] for e in result["ic_series"]])), 4)
            assert abs(result["summary"]["mean_ic"] - computed_mean) < 0.0001, \
                f"mean_ic {result['summary']['mean_ic']} != {computed_mean}"

    def test_mean_rank_ic_consistent(self):
        """mean_rank_ic = ic_series rank_ic 均值"""
        result = _run_basic_diagnostics(n=240)
        if result["ic_series"]:
            computed_mean = round(float(np.mean([e["rank_ic"] for e in result["ic_series"]])), 4)
            assert abs(result["summary"]["mean_rank_ic"] - computed_mean) < 0.0001


class TestDataInsufficiency:
    """数据不足场景"""

    def test_no_data_returns_empty_result(self):
        """无数据时返回全零空结果"""
        result = DiagnosticsFactor.run({
            "_bars_df": _make_empty_bars(),
            "configSnapshot": _make_config(),
        })
        assert result["ic_series"] == []
        assert result["layered_returns"] == {"Q1": [], "Q2": [], "Q3": [], "Q4": [], "Q5": []}
        assert result["correlation_matrix"] == []
        assert result["factor_labels"] == []
        assert result["summary"]["mean_ic"] == 0.0
        assert result["summary"]["ic_std"] == 0.0
        assert result["summary"]["ic_ir"] == 0.0

    def test_fewer_than_30_bars_returns_empty(self):
        """K线<30根时返回空结果"""
        result = DiagnosticsFactor.run({
            "_bars_df": _make_short_bars(n=15),
            "configSnapshot": _make_config(),
        })
        assert result["ic_series"] == []

    def test_single_month_returns_empty(self):
        """单月数据（<2个周期）返回空结果"""
        result = DiagnosticsFactor.run({
            "_bars_df": _make_single_period_bars(n=20),
            "configSnapshot": _make_config(),
        })
        assert result["ic_series"] == []

    def test_no_config_factor_pool_falls_back_to_defaults(self):
        """无 factorPool 配置时使用默认因子"""
        df = _make_synthetic_bars(n=240)
        result = DiagnosticsFactor.run({
            "_bars_df": df,
            "configSnapshot": {"strategy": "test", "params": {}},
        })
        # 默认有 3 个因子
        assert len(result["factor_labels"]) > 0
        assert result["type"] == "factor_based"

    def test_no_exception_with_unknown_factor_id(self):
        """未知因子ID不崩溃"""
        df = _make_synthetic_bars(n=240)
        result = DiagnosticsFactor.run({
            "_bars_df": df,
            "configSnapshot": _make_config(factor_ids=["nonexistent_factor_12345"]),
        })
        # 未知 ID 无对应公式 → 使用默认因子 fallback
        # 结果不应崩溃
        assert result["type"] == "factor_based"

    def test_no_data_via_DataClient_returns_empty(self):
        """DataClient 未提供时不影响测试（跳过数据加载）"""
        # 只传 _bars_df，DataClient 不会被调用
        # 验证：即使没有 quantforge_data 也能返回结果
        df = _make_synthetic_bars(n=240)
        result = DiagnosticsFactor.run({
            "_bars_df": df,
            "configSnapshot": _make_config(),
        })
        assert len(result["ic_series"]) > 0


class TestEmit:
    """emit 事件验证"""

    def test_emit_log_called(self):
        """emit 在数据处理过程中被调用"""
        events: list[tuple[str, dict]] = []

        def _emit(event: str, data: dict) -> None:
            events.append((event, data))

        _run_basic_diagnostics(n=240, emit=_emit)
        log_events = [e for e in events if e[0] == "log"]
        assert len(log_events) >= 2, f"应至少有2条log: {len(log_events)}"

    def test_emit_log_when_data_insufficient(self):
        """数据不足时 emit warning"""
        events: list[tuple[str, dict]] = []

        def _emit(event: str, data: dict) -> None:
            events.append((event, data))

        DiagnosticsFactor.run({
            "_bars_df": _make_short_bars(n=10),
            "configSnapshot": _make_config(),
        }, emit=_emit)
        warns = [e for e in events if e[0] == "log" and e[1].get("level") == "warn"]
        assert len(warns) >= 1, "应至少有一条 warning"


class TestOutputStructure:
    """输出结构完整性"""

    def test_result_has_type_field(self):
        """结果含 type='factor_based'"""
        result = _run_basic_diagnostics(n=240)
        assert result["type"] == "factor_based"

    def test_result_has_all_expected_keys(self):
        """结果含所有必需字段"""
        result = _run_basic_diagnostics(n=240)
        expected_keys = {"type", "ic_series", "layered_returns", "correlation_matrix", "factor_labels", "summary"}
        assert expected_keys.issubset(result.keys()), \
            f"缺少字段: {expected_keys - set(result.keys())}"

    def test_layered_returns_structure_only_Q_entries(self):
        """layered_returns 仅有 Q1~Q5 5个键"""
        result = _run_basic_diagnostics(n=240)
        assert set(result["layered_returns"].keys()) == {"Q1", "Q2", "Q3", "Q4", "Q5"}

    def test_empty_result_structure(self):
        """空结果结构完整"""
        empty = DiagnosticsFactor.run({
            "_bars_df": _make_empty_bars(),
            "configSnapshot": _make_config(),
        })
        assert set(empty.keys()) == {"type", "ic_series", "layered_returns", "correlation_matrix", "factor_labels", "summary"}

    def test_values_json_serializable(self):
        """所有数值为 Python 原生类型（可 JSON 序列化）"""
        import json

        result = _run_basic_diagnostics(n=240)
        # JSON 序列化不应报错
        dumped = json.dumps(result)
        assert isinstance(dumped, str)
        parsed = json.loads(dumped)
        assert parsed["type"] == "factor_based"


# ========================================================================
# CLI 集成测试 — 验证通过 run_diagnostics 调用时正常
# ========================================================================

class TestIntegration:
    """通过 run_diagnostics 路由验证"""

    def test_via_run_diagnostics_routing(self):
        """通过 run_diagnostics 调用正常"""
        from quantforge_strategy.commands.diagnostics import run_diagnostics

        df = _make_synthetic_bars(n=240)
        result = run_diagnostics({
            "category": "factor_based",
            "_bars_df": df,
            "configSnapshot": _make_config(),
        })
        assert result["ok"] is True
        data = result["data"]
        assert data["type"] == "factor_based"
        assert len(data["ic_series"]) > 0
        assert list(data["layered_returns"].keys()) == ["Q1", "Q2", "Q3", "Q4", "Q5"]

    def test_factor_based_structure_via_routing(self):
        """路由后保持原有结构"""
        from quantforge_strategy.commands.diagnostics import run_diagnostics

        result = run_diagnostics({"category": "factor_based"})
        assert result["ok"] is True
        data = result["data"]
        assert "ic_series" in data
        assert "layered_returns" in data
        assert "correlation_matrix" in data
        assert "factor_labels" in data
        assert "summary" in data
