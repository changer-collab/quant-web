"""非因子型诊断算法测试 — 参数敏感性 / 信号质量 / 滑点压力"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd
import pytest

from quantforge_strategy.commands.diagnostics.non_factor import DiagnosticsNonFactor


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
        dates = pd.date_range("2025-01-01", periods=n, freq="B")
        df["timestamp"] = dates.astype(np.int64) // 10 ** 6

    return df


def _make_empty_bars() -> pd.DataFrame:
    """生成空 DataFrame（列齐全但0行）"""
    return pd.DataFrame(columns=["symbol", "timeframe", "timestamp", "open", "high", "low", "close", "volume"])


def _make_short_bars(n: int = 15) -> pd.DataFrame:
    """生成短序列（<30根，测试数据不足场景）"""
    return _make_synthetic_bars(n=n, seed=SEED)


def _make_non_factor_config(
    include_ui: bool = True,
    extra_params: dict | None = None,
) -> dict:
    """生成非因子策略的 configSnapshot 参数字典

    参数:
        include_ui: 是否包含 uiConstraints（开启后有 3 个有界参数）
        extra_params: 额外参数字典（注入测试用特殊参数）
    """
    params: dict = {
        "fast_ma_period": 10,
        "slow_ma_period": 30,
        "entry_threshold": 0.02,
        "signal_type": "ma_crossover",
        "lookback": 20,
    }

    if include_ui:
        params["uiConstraints"] = {
            "fast_ma_period": {"min": 3, "max": 50},
            "slow_ma_period": {"min": 10, "max": 200},
            "entry_threshold": {"min": 0.001, "max": 0.1},
        }

    if extra_params:
        params.update(extra_params)

    return {
        "strategy": "test_non_factor",
        "params": params,
    }


def _run_basic_diagnostics(
    n: int = 240,
    include_ui: bool = True,
    extra_params: dict | None = None,
    emit: callable | None = None,
) -> dict:
    """便捷函数：创建合成数据后调用 DiagnosticsNonFactor.run()"""
    df = _make_synthetic_bars(n=n)
    params = {
        "_bars_df": df,
        "symbol": "TEST",
        "timeframe": "1d",
        "dataRange": {},
        "configSnapshot": _make_non_factor_config(include_ui=include_ui, extra_params=extra_params),
    }
    return DiagnosticsNonFactor.run(params, emit=emit)


# ========================================================================
# 测试类
# ========================================================================


class TestParamSensitivity:
    """参数敏感性验证"""

    def test_sensitivity_has_expected_params(self):
        """含 uiConstraints 的参数均出现在结果中"""
        result = _run_basic_diagnostics(n=240)
        sensitivity = result["param_sensitivity"]
        param_names = [s["param"] for s in sensitivity]
        # fast_ma_period / slow_ma_period / entry_threshold 三个都有 uiConstraints
        assert "fast_ma_period" in param_names
        assert "slow_ma_period" in param_names
        assert "entry_threshold" in param_names

    def test_each_param_has_5_values(self):
        """每个参数含 5 个值点"""
        result = _run_basic_diagnostics(n=240)
        for s in result["param_sensitivity"]:
            assert len(s["values"]) == 5, f"参数 {s['param']} 应有5个值, 实际{len(s['values'])}"
            assert len(s["returns"]) == 5, f"参数 {s['param']} 应有5个收益, 实际{len(s['returns'])}"
            assert len(s["sharpe"]) == 5, f"参数 {s['param']} 应有5个夏普, 实际{len(s['sharpe'])}"

    def test_values_are_monotonic(self):
        """values 在 [min, max] 内单调递增"""
        result = _run_basic_diagnostics(n=240)
        for s in result["param_sensitivity"]:
            values = s["values"]
            assert all(values[i] < values[i + 1] for i in range(len(values) - 1)), \
                f"参数 {s['param']} 值应单调递增: {values}"

    def test_values_span_correct_range(self):
        """values 在正确的 [min, max] 范围内"""
        result = _run_basic_diagnostics(n=240)
        for s in result["param_sensitivity"]:
            vmin = min(s["values"])
            vmax = max(s["values"])
            if s["param"] == "fast_ma_period":
                assert vmin >= 3.0 and vmax <= 50.0, f"fast_ma_period 范围异常: {vmin}~{vmax}"
            elif s["param"] == "slow_ma_period":
                assert vmin >= 10.0 and vmax <= 200.0, f"slow_ma_period 范围异常: {vmin}~{vmax}"
            elif s["param"] == "entry_threshold":
                assert vmin >= 0.001 and vmax <= 0.1, f"entry_threshold 范围异常: {vmin}~{vmax}"

    def test_returns_and_sharpe_are_floats(self):
        """returns 和 sharpe 均为 float 类型"""
        result = _run_basic_diagnostics(n=240)
        for s in result["param_sensitivity"]:
            for r in s["returns"]:
                assert isinstance(r, float), f"return {r} 不是 float"
            for sh in s["sharpe"]:
                assert isinstance(sh, float), f"sharpe {sh} 不是 float"

    def test_param_sensitivity_has_required_fields(self):
        """每个敏感性条目含 param / values / returns / sharpe"""
        result = _run_basic_diagnostics(n=240)
        for s in result["param_sensitivity"]:
            assert "param" in s
            assert "values" in s
            assert "returns" in s
            assert "sharpe" in s


class TestSignalQuality:
    """信号质量验证"""

    def test_signal_quality_has_required_fields(self):
        """signal_quality 含 total_signals / win_rate / avg_holding_bars / profit_factor / max_consecutive_losses"""
        result = _run_basic_diagnostics(n=240)
        sq = result["signal_quality"]
        assert "total_signals" in sq
        assert "win_rate" in sq
        assert "avg_holding_bars" in sq
        assert "profit_factor" in sq
        assert "max_consecutive_losses" in sq

    def test_signal_quality_types(self):
        """各字段类型正确"""
        result = _run_basic_diagnostics(n=240)
        sq = result["signal_quality"]
        assert isinstance(sq["total_signals"], int)
        assert isinstance(sq["win_rate"], float)
        assert isinstance(sq["avg_holding_bars"], float)
        assert isinstance(sq["profit_factor"], float)
        assert isinstance(sq["max_consecutive_losses"], int)

    def test_signal_quality_reasonable_values(self):
        """信号质量值在合理范围内"""
        result = _run_basic_diagnostics(n=240)
        sq = result["signal_quality"]
        assert 0.0 <= sq["win_rate"] <= 1.0, f"win_rate 越界: {sq['win_rate']}"
        assert sq["profit_factor"] >= 0.0, f"profit_factor 为负: {sq['profit_factor']}"
        assert sq["max_consecutive_losses"] >= 0
        assert sq["total_signals"] >= 0

    def test_signal_quality_with_few_trades(self):
        """少量交易时仍返回完整结构"""
        short_df = _make_synthetic_bars(n=50)
        params = {
            "_bars_df": short_df,
            "configSnapshot": _make_non_factor_config(),
        }
        result = DiagnosticsNonFactor.run(params)
        sq = result["signal_quality"]
        assert "total_signals" in sq
        assert "win_rate" in sq
        assert "profit_factor" in sq
        assert sq["total_signals"] >= 0


class TestSlippageStress:
    """滑点压力验证"""

    def test_slippage_stress_has_4_bands(self):
        """slippage_stress 含 1/3/5/10 bps 共 4 档"""
        result = _run_basic_diagnostics(n=240)
        stress = result["slippage_stress"]
        assert len(stress) == 4, f"应有4档, 实际{len(stress)}"
        bps_values = [s["bps"] for s in stress]
        assert bps_values == [1, 3, 5, 10], f"bps档位异常: {bps_values}"

    def test_slippage_stress_has_required_fields(self):
        """每档含 bps / return / sharpe / trade_count"""
        result = _run_basic_diagnostics(n=240)
        for entry in result["slippage_stress"]:
            assert "bps" in entry
            assert "return" in entry
            assert "sharpe" in entry
            assert "trade_count" in entry

    def test_slippage_stress_types(self):
        """各字段类型正确"""
        result = _run_basic_diagnostics(n=240)
        for entry in result["slippage_stress"]:
            assert isinstance(entry["bps"], int)
            assert isinstance(entry["return"], float)
            assert isinstance(entry["sharpe"], float)
            assert isinstance(entry["trade_count"], int)

    def test_slippage_reduces_return(self):
        """滑点越高，收益越低（或不变）（非严格，因为信号可能变化）"""
        result = _run_basic_diagnostics(n=240)
        stress = result["slippage_stress"]
        # 至少检查 1 bps >= 10 bps 的 return（允许等于，因为无交易时都为零）
        assert stress[0]["return"] >= stress[-1]["return"], \
            f"滑点1bps收益 {stress[0]['return']} 应 >= 滑点10bps收益 {stress[-1]['return']}"

    def test_trade_count_across_slippage(self):
        """各滑点档的交易数量一致（信号不变）"""
        result = _run_basic_diagnostics(n=240)
        stress = result["slippage_stress"]
        counts = [s["trade_count"] for s in stress]
        # 有交易时交易数量一致
        if any(c > 0 for c in counts):
            assert len(set(counts)) == 1, f"交易数量应一致: {counts}"


class TestParamNoMinMax:
    """无 min/max 参数的跳过行为"""

    def test_params_without_minmax_are_skipped(self):
        """无 uiConstraints 的数值参数不生成敏感性条目"""
        # 构造：只有 signal_type（字符串）和 lookback（数值但无 uiConstraints）
        config = {
            "strategy": "test_no_ui",
            "params": {
                "fast_ma_period": 10,
                "signal_type": "ma_crossover",
                "lookback": 20,
            },
            # 没有 uiConstraints 键
        }
        df = _make_synthetic_bars(n=120)
        # 额外传一个带 uiConstraints 的，确保有一条结果
        params = {
            "_bars_df": df,
            "configSnapshot": config,
            "extraParam": {
                "name": "fast_ma_period",
                "default": 10,
                "min": 3,
                "max": 50,
            },
        }
        # 不使用 _run_basic_diagnostics，因为我们测试无 uiConstraints 的场景
        result = DiagnosticsNonFactor.run(params)
        # 没有 uiConstraints → 没有参数字段有 min/max → param_sensitivity 为空
        assert result["param_sensitivity"] == [], \
            f"无 uiConstraints 时 param_sensitivity 应为空, 实际 {result['param_sensitivity']}"

    def test_no_crash_when_params_empty(self):
        """无策略参数时不崩溃"""
        df = _make_synthetic_bars(n=120)
        result = DiagnosticsNonFactor.run({
            "_bars_df": df,
            "configSnapshot": {"strategy": "empty", "params": {}},
        })
        assert result["type"] == "non_factor"
        assert result["param_sensitivity"] == []

    def test_no_crash_when_config_missing(self):
        """无 configSnapshot 时不崩溃"""
        df = _make_synthetic_bars(n=120)
        result = DiagnosticsNonFactor.run({
            "_bars_df": df,
        })
        assert result["type"] == "non_factor"
        assert "signal_quality" in result
        assert "slippage_stress" in result


class TestDataInsufficiency:
    """数据不足场景"""

    def test_no_data_returns_empty_result(self):
        """无数据时返回空结果"""
        result = DiagnosticsNonFactor.run({
            "_bars_df": _make_empty_bars(),
            "configSnapshot": _make_non_factor_config(),
        })
        assert result["param_sensitivity"] == []
        assert result["signal_quality"]["total_signals"] == 0
        assert result["signal_quality"]["win_rate"] == 0.0
        assert len(result["slippage_stress"]) == 4

    def test_fewer_than_30_bars_returns_empty(self):
        """K线<30根时返回空结果"""
        result = DiagnosticsNonFactor.run({
            "_bars_df": _make_short_bars(n=15),
            "configSnapshot": _make_non_factor_config(),
        })
        assert result["param_sensitivity"] == []
        assert result["signal_quality"]["total_signals"] == 0

    def test_no_exception_on_missing_close_column(self):
        """缺少 close 列时不崩溃"""
        df = pd.DataFrame({"open": [100] * 30})
        result = DiagnosticsNonFactor.run({
            "_bars_df": df,
            "configSnapshot": _make_non_factor_config(),
        })
        assert result["type"] == "non_factor"


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

    def test_emit_warning_when_data_insufficient(self):
        """数据不足时 emit warning"""
        events: list[tuple[str, dict]] = []

        def _emit(event: str, data: dict) -> None:
            events.append((event, data))

        DiagnosticsNonFactor.run({
            "_bars_df": _make_short_bars(n=10),
            "configSnapshot": _make_non_factor_config(),
        }, emit=_emit)
        warns = [e for e in events if e[0] == "log" and e[1].get("level") == "warn"]
        assert len(warns) >= 1, "应至少有一条 warning"


class TestOutputStructure:
    """输出结构完整性"""

    def test_result_has_type_field(self):
        """结果含 type='non_factor'"""
        result = _run_basic_diagnostics(n=240)
        assert result["type"] == "non_factor"

    def test_result_has_all_expected_keys(self):
        """结果含所有必需字段"""
        result = _run_basic_diagnostics(n=240)
        expected_keys = {"type", "param_sensitivity", "signal_quality", "slippage_stress"}
        assert expected_keys.issubset(result.keys()), \
            f"缺少字段: {expected_keys - set(result.keys())}"

    def test_json_serializable(self):
        """所有数值为 Python 原生类型（可 JSON 序列化）"""
        result = _run_basic_diagnostics(n=240)
        dumped = json.dumps(result)
        assert isinstance(dumped, str)
        parsed = json.loads(dumped)
        assert parsed["type"] == "non_factor"

    def test_empty_result_structure(self):
        """空结果结构完整"""
        empty = DiagnosticsNonFactor.run({
            "_bars_df": _make_empty_bars(),
            "configSnapshot": _make_non_factor_config(),
        })
        assert set(empty.keys()) == {"type", "param_sensitivity", "signal_quality", "slippage_stress"}


# ========================================================================
# CLI 集成测试 — 验证通过 run_diagnostics 路由时正常
# ========================================================================

class TestIntegration:
    """通过 run_diagnostics 路由验证"""

    def test_via_run_diagnostics_routing(self):
        """通过 run_diagnostics 调用正常"""
        from quantforge_strategy.commands.diagnostics import run_diagnostics

        df = _make_synthetic_bars(n=240)
        result = run_diagnostics({
            "category": "non_factor",
            "_bars_df": df,
            "configSnapshot": _make_non_factor_config(),
        })
        assert result["ok"] is True
        data = result["data"]
        assert data["type"] == "non_factor"
        assert "param_sensitivity" in data
        assert "signal_quality" in data
        assert "slippage_stress" in data

    def test_via_run_diagnostics_missing_config(self):
        """路由后即使无配置也不崩溃"""
        from quantforge_strategy.commands.diagnostics import run_diagnostics

        df = _make_synthetic_bars(n=240)
        result = run_diagnostics({
            "category": "non_factor",
            "_bars_df": df,
        })
        assert result["ok"] is True
        assert result["data"]["type"] == "non_factor"

    def test_non_factor_structure_via_routing(self):
        """路由后保持原有结构"""
        from quantforge_strategy.commands.diagnostics import run_diagnostics

        result = run_diagnostics({"category": "non_factor"})
        assert result["ok"] is True
        data = result["data"]
        assert "param_sensitivity" in data
        assert "signal_quality" in data
        assert "slippage_stress" in data
