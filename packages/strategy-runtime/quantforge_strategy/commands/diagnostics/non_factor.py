"""非因子型策略诊断 — 参数敏感性 / 信号质量 / 滑点压力

根据 params 中的 configSnapshot 读取策略参数和 uiConstraints：
1. 参数敏感性：对每个数值型参数在 [min,max] 均匀取 5 个值，各跑简化回测
2. 信号质量：统计 total_signals / win_rate / avg_holding_bars / profit_factor / max_consecutive_losses
3. 滑点压力：1/3/5/10 bps 各重算收益和夏普

参数无 min/max 时跳过，不崩溃。
数据不足时返回空数组并 emit warning，不崩溃。
"""

from __future__ import annotations

from typing import Any, Callable

import numpy as np
import pandas as pd


# ========================================================================
# 主诊断类
# ========================================================================


class DiagnosticsNonFactor:
    """非因子型策略诊断"""

    @staticmethod
    def run(
        params: dict[str, Any],
        emit: Callable[[str, dict], None] | None = None,
    ) -> dict[str, Any]:
        """运行非因子型诊断

        参数:
            params: dict
                - symbol / timeframe / dataRange: 数据加载参数
                - configSnapshot: {strategy, params} 含策略参数和 uiConstraints
                - _bars_df: 测试用预加载 DataFrame（非 None 时跳过 DataClient）
            emit: NDJSON 事件发射器

        返回:
            dict — type='non_factor' 的诊断结果
        """
        _emit = emit or (lambda *a, **kw: None)

        # ── 1. 提取参数 ──────────────────────────────────────────────────
        symbol = params.get("symbol", "")
        timeframe_str = params.get("timeframe", "1d")
        data_range = params.get("dataRange", {})
        config_snapshot = params.get("configSnapshot", {})

        # ── 2. 加载 K 线数据 ─────────────────────────────────────────────
        bars_df: pd.DataFrame | None = params.get("_bars_df")
        if bars_df is None:
            try:
                from quantforge_data import DataClient
                from quantforge_strategy import TimeFrame

                db_path = data_range.get("dbPath", "data/quant.db")
                timeframe = TimeFrame(timeframe_str)
                client = DataClient(db_path)
                bars_df = client.query_bars_df(
                    symbol, timeframe,
                    start_ts=data_range.get("startTs"),
                    end_ts=data_range.get("endTs"),
                )
            except Exception as exc:
                _emit("log", {"level": "warn", "message": f"数据加载失败: {exc}"})
                return _empty_result()

        # ── 3. 数据校验 ──────────────────────────────────────────────────
        if bars_df is None or len(bars_df) < 30:
            _emit("log", {"level": "warn", "message": "K线数据不足（<30根）"})
            return _empty_result()

        if "close" not in bars_df.columns:
            _emit("log", {"level": "warn", "message": "数据缺少 close 列"})
            return _empty_result()

        _emit("log", {"level": "info", "message": f"已加载 {len(bars_df)} 根 K 线"})

        # ── 4. 解析策略参数和 uiConstraints ──────────────────────────────
        strategy_params = config_snapshot.get("params", {})
        numeric_params = _extract_numeric_params(strategy_params)
        _emit("log", {
            "level": "info",
            "message": f"提取 {len(numeric_params)} 个可分析数值参数",
        })

        # ── 5. 参数敏感性分析 ────────────────────────────────────────────
        param_sensitivity = _compute_param_sensitivity(
            bars_df, numeric_params, _emit,
        )

        # ── 6. 基准信号生成 ──────────────────────────────────────────────
        base_signal_period = _pick_signal_period(numeric_params)
        total_ret, sharpe, trades = _simulate_trading(
            bars_df["close"].values,
            period=base_signal_period,
            slippage_bps=0,
        )
        _emit("log", {
            "level": "info",
            "message": f"基准信号: {len(trades)} 笔交易, return={total_ret:.4%}, sharpe={sharpe:.2f}",
        })

        if not trades:
            _emit("log", {"level": "warn", "message": "未产生交易信号，改用泛化信号"})
            total_ret, sharpe, trades = _fallback_simulation(bars_df["close"].values)

        # ── 7. 信号质量 ──────────────────────────────────────────────────
        signal_quality = _compute_signal_quality(trades)
        _emit("log", {
            "level": "info",
            "message": f"信号质量: {signal_quality['total_signals']} 笔, "
                       f"胜率 {signal_quality['win_rate']:.1%}",
        })

        # ── 8. 滑点压力 ─────────────────────────────────────────────────
        slippage_stress = _compute_slippage_stress(
            bars_df["close"].values,
            base_signal_period,
            trades,
            _emit,
        )

        _emit("log", {"level": "info", "message": "非因子诊断完成"})

        return {
            "type": "non_factor",
            "param_sensitivity": param_sensitivity,
            "signal_quality": signal_quality,
            "slippage_stress": slippage_stress,
        }


# ========================================================================
# 内部函数
# ========================================================================


def _empty_result() -> dict[str, Any]:
    """返回空诊断结果（数据不足时使用）"""
    return {
        "type": "non_factor",
        "param_sensitivity": [],
        "signal_quality": {
            "total_signals": 0,
            "win_rate": 0.0,
            "avg_holding_bars": 0.0,
            "profit_factor": 0.0,
            "max_consecutive_losses": 0,
        },
        "slippage_stress": [
            {"bps": 1, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
            {"bps": 3, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
            {"bps": 5, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
            {"bps": 10, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
        ],
    }


def _extract_numeric_params(strategy_params: dict[str, Any]) -> list[dict[str, Any]]:
    """从策略参数中提取数值型参数及其 uiConstraints 中的 min/max

    支持两种 uiConstraints 存放格式：
    A. params.uiConstraints 顶级键 → 按参数名查找
    B. 参数值为 dict 且含 uiConstraints 子键（{value, uiConstraints}）
    """
    # ── 从 params 中提取所有数值型字段 ──
    numeric_candidates: list[dict[str, Any]] = []

    for key, raw_value in strategy_params.items():
        # 跳过特殊字段
        if key in (
            "factorPool", "preprocessing", "indicators",
            "dataSource", "decayHalfLife", "targetFactor",
            "uiConstraints", "_uiConstraints",
        ):
            continue

        if isinstance(raw_value, (int, float)):
            numeric_candidates.append({"name": key, "default": float(raw_value)})
        elif isinstance(raw_value, dict) and "value" in raw_value:
            # 格式: {value: X, uiConstraints: {min, max}}
            val = raw_value["value"]
            if isinstance(val, (int, float)):
                entry: dict[str, Any] = {"name": key, "default": float(val)}
                ui = raw_value.get("uiConstraints", {})
                if isinstance(ui, dict) and "min" in ui and "max" in ui:
                    entry["min"] = float(ui["min"])
                    entry["max"] = float(ui["max"])
                numeric_candidates.append(entry)

    # ── 尝试从 strategy_params['uiConstraints'] 补全 min/max ──
    ui_constraints: dict[str, Any] = {}
    raw_ui = strategy_params.get("uiConstraints", {})
    if isinstance(raw_ui, dict):
        for ui_key, ui_val in raw_ui.items():
            if isinstance(ui_val, dict) and "min" in ui_val and "max" in ui_val:
                ui_constraints[ui_key] = {
                    "min": float(ui_val["min"]),
                    "max": float(ui_val["max"]),
                }

    # 将外部 uiConstraints 合并到各候选参数
    for entry in numeric_candidates:
        if "min" not in entry and entry["name"] in ui_constraints:
            entry["min"] = ui_constraints[entry["name"]]["min"]
            entry["max"] = ui_constraints[entry["name"]]["max"]

    return numeric_candidates


def _compute_param_sensitivity(
    bars_df: pd.DataFrame,
    numeric_params: list[dict[str, Any]],
    emit: Callable[[str, dict], None],
) -> list[dict[str, Any]]:
    """参数敏感性分析：对每个有 min/max 的参数取 5 个值，各跑简化回测

    返回:
        [{param, values, returns, sharpe}, ...]
    """
    results: list[dict[str, Any]] = []

    for pdef in numeric_params:
        name = pdef["name"]

        if "min" not in pdef or "max" not in pdef:
            emit("log", {"level": "info", "message": f"  参数 {name} 无 min/max，跳过"})
            continue

        pmin = pdef["min"]
        pmax = pdef["max"]
        if pmax <= pmin:
            emit("log", {"level": "info", "message": f"  参数 {name} min>=max，跳过"})
            continue

        # 均匀取 5 个值
        values = [pmin + (pmax - pmin) * i / 4 for i in range(5)]
        returns: list[float] = []
        sharpes: list[float] = []

        for val in values:
            ret, sharpe, _ = _simulate_trading(
                bars_df["close"].values,
                period=max(2, int(abs(val or 10))),
                slippage_bps=0,
            )
            returns.append(round(float(ret), 6))
            sharpes.append(round(float(sharpe), 4))

        results.append({
            "param": name,
            "values": [round(float(v), 4) for v in values],
            "returns": returns,
            "sharpe": sharpes,
        })
        emit("log", {"level": "info", "message": f"  参数 {name}: [{pmin}, {pmax}] → 5 值点"})

    if not results:
        emit("log", {"level": "info", "message": "  无可分析的有界数值参数"})

    return results


def _pick_signal_period(numeric_params: list[dict[str, Any]]) -> int:
    """从数值参数中选取一个合理的信号周期，兜底 10"""
    if not numeric_params:
        return 10
    # 优先用第一个数值参数，避开极端值
    candidate = numeric_params[0].get("default", 10)
    return max(3, min(60, int(abs(candidate))))


def _generate_ma_signal(
    close_values: np.ndarray,
    period: int,
) -> np.ndarray:
    """基于价格与移动平均线关系生成交易信号

    信号逻辑:
        - close > MA * 1.002  → 多头 (1)
        - close < MA * 0.998  → 空头 (-1)
        - 其他                 → 平仓 (0)

    返回:
        ndarray, 形状 (n,)，值 ∈ {-1, 0, 1}
    """
    n = len(close_values)
    if period >= n:
        return np.zeros(n, dtype=np.int8)

    # 计算移动平均
    prices = pd.Series(close_values)
    ma = prices.rolling(window=period).mean().values

    signals = np.zeros(n, dtype=np.int8)
    threshold = 0.002  # 0.2% 缓冲带，减少噪音

    for i in range(period, n):
        if close_values[i] > ma[i] * (1.0 + threshold):
            signals[i] = 1
        elif close_values[i] < ma[i] * (1.0 - threshold):
            signals[i] = -1

    return signals


def _simulate_trading(
    close_values: np.ndarray,
    period: int = 10,
    slippage_bps: float = 0.0,
) -> tuple[float, list[dict[str, Any]]]:
    """简化回测模拟：根据 MA 信号生成交易记录

    参数:
        close_values: 收盘价序列
        period: MA 周期
        slippage_bps: 滑点（基点，如 1 = 0.01%）

    返回:
        (累计收益率, 交易列表)
        交易条目: {entry_idx, exit_idx, pnl_pct, is_win, holding_bars}
    """
    n = len(close_values)
    signals = _generate_ma_signal(close_values, period)
    slippage = slippage_bps / 10000.0

    position = 0        # 当前持仓方向: 1/-1/0
    entry_price = 0.0
    entry_idx = 0
    trades: list[dict[str, Any]] = []
    cumulative_ret = 1.0

    for i in range(1, n):
        sig = int(signals[i]) if i < len(signals) else 0

        # ── 信号变化 → 平旧仓 ──
        if sig != position and position != 0:
            cost = slippage * (1.0 if position > 0 else -1.0)
            exit_price = float(close_values[i]) * (1.0 - cost)
            gross_ret = position * (exit_price - entry_price) / entry_price if entry_price > 1e-10 else 0.0
            trade = {
                "entry_idx": entry_idx,
                "exit_idx": i,
                "pnl_pct": round(float(gross_ret), 6),
                "is_win": bool(gross_ret > 0),
                "holding_bars": i - entry_idx,
            }
            trades.append(trade)
            cumulative_ret *= 1.0 + gross_ret

        # ── 信号变化 → 开新仓 ──
        if sig != position and sig != 0:
            cost = slippage * (1.0 if sig > 0 else -1.0)
            entry_price = float(close_values[i]) * (1.0 + cost)
            entry_idx = i

        position = sig

    # ── 收盘时平掉未平仓位 ──
    if position != 0:
        cost = slippage * (1.0 if position > 0 else -1.0)
        exit_price = float(close_values[-1]) * (1.0 - cost)
        gross_ret = position * (exit_price - entry_price) / entry_price if entry_price > 1e-10 else 0.0
        trades.append({
            "entry_idx": entry_idx,
            "exit_idx": n - 1,
            "pnl_pct": round(float(gross_ret), 6),
            "is_win": bool(gross_ret > 0),
            "holding_bars": n - 1 - entry_idx,
        })
        cumulative_ret *= 1.0 + gross_ret

    total_return = cumulative_ret - 1.0

    # ── 夏普比率（日频年化） ──
    # 根据交易记录重建日收益率序列
    if trades:
        daily_rets = _rebuild_daily_returns(close_values, trades)
        if len(daily_rets) > 1:
            mean_ret = float(np.mean(daily_rets))
            std_ret = float(np.std(daily_rets, ddof=1))
            sharpe = round(mean_ret / std_ret * np.sqrt(252), 4) if std_ret > 1e-10 else 0.0
        else:
            sharpe = 0.0
    else:
        sharpe = 0.0

    return total_return, sharpe, trades


def _rebuild_daily_returns(
    close_values: np.ndarray,
    trades: list[dict[str, Any]],
) -> list[float]:
    """从交易记录重建日收益率序列"""
    n = len(close_values)
    position_map = np.zeros(n)
    for t in trades:
        entry = t["entry_idx"]
        exit_ = t["exit_idx"]
        # 从 entry 到 exit-1 持有头寸
        for j in range(entry, min(exit_, n - 1)):
            position_map[j + 1] = 1.0  # 简化：只做多
    daily = []
    for i in range(1, n):
        if position_map[i] != 0:
            ret = (close_values[i] - close_values[i - 1]) / close_values[i - 1]
            daily.append(ret)
    return daily


def _fallback_simulation(
    close_values: np.ndarray,
) -> tuple[float, list[dict[str, Any]]]:
    """当 MA 信号无法产生交易时，用价格方向信号兜底"""
    n = len(close_values)
    trades: list[dict[str, Any]] = []
    cumulative = 1.0

    # 简单规则：连续上涨则做多，连续下跌则做空
    for i in range(5, n - 1):
        short_ma = float(np.mean(close_values[i - 4:i + 1]))
        long_ma = float(np.mean(close_values[max(0, i - 19):i + 1]))

        if short_ma > long_ma * 1.001:
            # 做多
            entry = close_values[i]
            exit_ = close_values[i + 1]
            gross_ret = (exit_ - entry) / entry
            trades.append({
                "entry_idx": i,
                "exit_idx": i + 1,
                "pnl_pct": round(float(gross_ret), 6),
                "is_win": bool(gross_ret > 0),
                "holding_bars": 1,
            })
            cumulative *= 1.0 + gross_ret

    total_return = cumulative - 1.0

    if trades:
        daily_rets = _rebuild_daily_returns(close_values, trades)
        if len(daily_rets) > 1:
            mean_ret = float(np.mean(daily_rets))
            std_ret = float(np.std(daily_rets, ddof=1))
            sharpe = round(mean_ret / std_ret * np.sqrt(252), 4) if std_ret > 1e-10 else 0.0
        else:
            sharpe = 0.0
    else:
        sharpe = 0.0

    return total_return, sharpe, trades


def _compute_signal_quality(
    trades: list[dict[str, Any]],
) -> dict[str, Any]:
    """计算信号质量统计

    返回:
        {total_signals, win_rate, avg_holding_bars, profit_factor, max_consecutive_losses}
    """
    if not trades:
        return {
            "total_signals": 0,
            "win_rate": 0.0,
            "avg_holding_bars": 0.0,
            "profit_factor": 0.0,
            "max_consecutive_losses": 0,
        }

    total_signals = len(trades)
    wins = [t for t in trades if t["is_win"]]
    losses = [t for t in trades if not t["is_win"]]
    win_rate = len(wins) / total_signals if total_signals > 0 else 0.0

    # 平均持仓 bar 数
    holding_bars = [t["holding_bars"] for t in trades]
    avg_holding = float(np.mean(holding_bars))

    # 盈亏比
    gross_profit = sum(t["pnl_pct"] for t in wins) if wins else 0.0
    gross_loss = abs(sum(t["pnl_pct"] for t in losses)) if losses else 0.0
    profit_factor = gross_profit / gross_loss if gross_loss > 1e-10 else (
        gross_profit if gross_profit > 0 else 0.0
    )

    # 最大连续亏损
    max_consec = 0
    current = 0
    for t in trades:
        if t["is_win"]:
            current = 0
        else:
            current += 1
            max_consec = max(max_consec, current)

    return {
        "total_signals": total_signals,
        "win_rate": round(win_rate, 4),
        "avg_holding_bars": round(avg_holding, 2),
        "profit_factor": round(profit_factor, 4),
        "max_consecutive_losses": max_consec,
    }


def _compute_slippage_stress(
    close_values: np.ndarray,
    base_period: int,
    base_trades: list[dict[str, Any]],
    emit: Callable[[str, dict], None],
) -> list[dict[str, Any]]:
    """滑点压力测试：1/3/5/10 bps 各重算收益和夏普

    基于基准信号（同一信号源），但施加不同滑点成本重算。
    交易数量不变，每笔盈亏降低。
    """
    slippage_levels = [1, 3, 5, 10]
    results: list[dict[str, Any]] = []

    for bps in slippage_levels:
        total_ret, sharpe, new_trades = _simulate_trading(
            close_values,
            period=base_period,
            slippage_bps=float(bps),
        )
        trade_count = len(new_trades)

        results.append({
            "bps": bps,
            "return": round(float(total_ret), 6),
            "sharpe": round(float(sharpe), 4),
            "trade_count": trade_count,
        })
        emit("log", {
            "level": "info",
            "message": f"  滑点 {bps} bps: return={total_ret:.4%}, sharpe={sharpe:.2f}",
        })

    return results
