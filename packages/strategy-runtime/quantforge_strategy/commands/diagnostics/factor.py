"""因子型策略诊断 — IC序列 / 分层收益 / 相关性矩阵

根据 params 中的 configSnapshot 读取因子定义，加载K线数据后：
1. 按月（周）分组计算各因子的 Pearson IC 和 Spearman Rank IC
2. 按首因子分 5 组（Q1~Q5）累积分层收益
3. 多因子周期均值 Pearson 相关矩阵
4. 汇总统计：mean_ic / ic_std / ic_ir / mean_rank_ic

数据不足时返回空数组并 emit warning，不崩溃。
"""

from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np
import pandas as pd


# ========================================================================
# 默认因子公式映射（按因子 ID 匹配 FormulaFactor 可理解的 AST 表达式）
# 生产环境应从因子注册表获取真实公式，这里提供基于 OHLCV 的合理代理。
# ========================================================================
_DEFAULT_FACTOR_FORMULAS: dict[str, str] = {
    "ep": "close / open",                          # 收益/价格代理
    "bp": "close / open",                          # 市净率代理
    "mom": "close / shift(close, 20)",             # 12M-1M 动量
    "size": "log(volume)",                         # 规模代理
    "vol": "rolling_std(close, 20)",               # 60日波动率（简化为20日）
    "turn": "rolling_mean(volume, 20)",            # 20日平均换手率
    "roe": "close / shift(close, 5)",              # 盈利能力代理
    "reversal": "close / shift(close, 5)",         # 短期反转代理
}


class DiagnosticsFactor:
    """因子型策略诊断"""

    @staticmethod
    def run(
        params: dict[str, Any],
        emit: Callable[[str, dict], None] | None = None,
    ) -> dict[str, Any]:
        """运行因子型诊断

        参数:
            params: dict
                - symbol / timeframe / dataRange: 数据加载参数
                - configSnapshot: {strategy, params} 含 factorPool
                - _bars_df: 测试用预加载 DataFrame（非 None 时跳过 DataClient）
            emit: NDJSON 事件发射器

        返回:
            dict — type='factor_based' 的诊断结果
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
                return _empty_result("factor_based")

        # ── 3. 数据校验 ──────────────────────────────────────────────────
        if bars_df is None or len(bars_df) < 30:
            _emit("log", {"level": "warn", "message": "K线数据不足（<30根）"})
            return _empty_result("factor_based")

        if "close" not in bars_df.columns:
            _emit("log", {"level": "warn", "message": "数据缺少 close 列"})
            return _empty_result("factor_based")

        _emit("log", {"level": "info", "message": f"已加载 {len(bars_df)} 根 K 线"})

        # ── 4. 前向收益（T+1 收益率）─────────────────────────────────────
        forward_returns = bars_df["close"].pct_change().shift(-1)

        # ── 5. 因子定义 ──────────────────────────────────────────────────
        factor_defs = _build_factor_defs(config_snapshot)
        if not factor_defs:
            # 默认用前 3 个因子
            factor_defs = [
                {"id": "mom", "formula": "close / shift(close, 20)"},
                {"id": "vol", "formula": "rolling_std(close, 20)"},
                {"id": "turn", "formula": "rolling_mean(volume, 20)"},
            ]

        # ── 6. 计算各因子值 ──────────────────────────────────────────────
        factor_values: dict[str, pd.Series] = {}
        factor_labels: list[str] = []

        for fdef in factor_defs:
            formula = fdef.get("formula", "")
            label = fdef.get("id", formula)
            if not formula:
                continue

            try:
                from quantforge_factor import FormulaFactor

                factor = FormulaFactor(formula)
                values = factor.compute(bars_df)
                valid_count = values.notna().sum()
                if valid_count >= 10:
                    factor_values[label] = values
                    factor_labels.append(label)
                    _emit("log", {
                        "level": "info",
                        "message": f"  因子 {label}: {valid_count}/{len(values)} 有效值",
                    })
            except Exception as exc:
                _emit("log", {"level": "warn", "message": f"  因子 {label} 计算失败: {exc}"})

        if not factor_values:
            _emit("log", {"level": "warn", "message": "无有效因子值"})
            return _empty_result("factor_based")

        # ── 7. 对齐数据 ──────────────────────────────────────────────────
        dates = _parse_dates(bars_df)
        periods = dates.dt.to_period("M")
        unique_periods = sorted(set(periods.dropna().unique()))

        if len(unique_periods) < 2:
            _emit("log", {"level": "warn", "message": "数据不足2个月"})
            return _empty_result("factor_based")

        aligned = pd.DataFrame(factor_values)
        aligned["forward_return"] = forward_returns.values
        aligned["period"] = periods.values
        aligned = aligned.replace([np.inf, -np.inf], np.nan).dropna()

        if len(aligned) < 10:
            _emit("log", {"level": "warn", "message": "对齐后有效数据不足10行"})
            return _empty_result("factor_based")

        # ── 8. IC 序列 ──────────────────────────────────────────────────
        ic_series = _compute_ic_series(aligned, factor_labels, unique_periods)

        # ── 9. 分层收益 ────────────────────────────────────────────────
        layered_returns = _compute_layered_returns(aligned, factor_labels, unique_periods)

        # ── 10. 相关性矩阵 ─────────────────────────────────────────────
        corr_matrix, used_labels = _compute_correlation_matrix(aligned, factor_labels)

        # ── 11. 汇总统计 ───────────────────────────────────────────────
        summary = _compute_summary(ic_series)

        _emit("log", {"level": "info", "message": f"因子诊断完成: {len(ic_series)} 期, {len(factor_labels)} 因子"})

        return {
            "type": "factor_based",
            "ic_series": ic_series,
            "layered_returns": layered_returns,
            "correlation_matrix": corr_matrix,
            "factor_labels": used_labels,
            "summary": summary,
        }


# ========================================================================
# 内部函数
# ========================================================================


def _build_factor_defs(config_snapshot: dict[str, Any]) -> list[dict[str, str]]:
    """从 configSnapshot 提取因子定义列表"""
    params = config_snapshot.get("params", {})
    factor_ids: list[str] = params.get("factorPool", [])
    if not factor_ids:
        return []

    defs: list[dict[str, str]] = []
    for fid in factor_ids:
        formula = _DEFAULT_FACTOR_FORMULAS.get(fid)
        if formula:
            defs.append({"id": fid, "formula": formula})
    return defs


def _parse_dates(bars_df: pd.DataFrame) -> pd.Series:
    """从 DataFrame 解析日期序列（兼容多种格式）"""
    if "timestamp" in bars_df.columns:
        sample = bars_df["timestamp"].iloc[0] if len(bars_df) > 0 else None
        if sample is not None and isinstance(sample, (int, float, np.integer, np.floating)):
            # 自动检测时间戳分辨率：秒 / 毫秒 / 微秒
            if sample > 1e15:  # 微秒 → 转秒
                return pd.to_datetime(bars_df["timestamp"] / 1_000_000, unit="s")
            if sample > 1e11:  # 毫秒 → 转秒 (> 1e11 避免 10位秒级误判)
                return pd.to_datetime(bars_df["timestamp"] / 1000, unit="s")
            return pd.to_datetime(bars_df["timestamp"], unit="s")
        return pd.to_datetime(bars_df["timestamp"])
    # 没有 timestamp 列则用 index
    return pd.to_datetime(bars_df.index)


def _compute_ic_series(
    aligned: pd.DataFrame,
    factor_labels: list[str],
    unique_periods: list[pd.Period],
) -> list[dict[str, Any]]:
    """按月计算各因子的 IC / Rank IC，返回序列"""
    series: list[dict[str, Any]] = []

    for period_label in unique_periods:
        mask = aligned["period"] == period_label
        subset = aligned[mask]
        if len(subset) < 5:
            continue

        ic_vals: list[float] = []
        rank_ic_vals: list[float] = []
        for flabel in factor_labels:
            fv = subset[flabel].astype(float)
            fr = subset["forward_return"].astype(float)
            valid = fv.notna() & fr.notna() & (~np.isinf(fv)) & (~np.isinf(fr))
            n_valid = valid.sum()
            if n_valid < 5:
                continue

            fv_v = fv[valid]
            fr_v = fr[valid]
            try:
                corr = float(fv_v.corr(fr_v))
                rank_corr = float(fv_v.corr(fr_v, method="spearman"))
                if not math.isnan(corr):
                    ic_vals.append(corr)
                if not math.isnan(rank_corr):
                    rank_ic_vals.append(rank_corr)
            except Exception:
                continue

        if ic_vals:
            series.append({
                "period": str(period_label),
                "ic": round(float(np.mean(ic_vals)), 4),
                "rank_ic": round(float(np.mean(rank_ic_vals)), 4) if rank_ic_vals else 0.0,
            })

    return series


def _compute_layered_returns(
    aligned: pd.DataFrame,
    factor_labels: list[str],
    unique_periods: list[pd.Period],
) -> dict[str, list[float]]:
    """按首因子值分 5 组（Q1~Q5），累积分层收益"""
    n_groups = 5
    group_labels = [f"Q{i + 1}" for i in range(n_groups)]
    cumulative: dict[str, list[float]] = {g: [1.0] for g in group_labels}

    # 用第一个因子做分层（后续增强可做因子均值排序）
    primary = factor_labels[0]

    for period_label in unique_periods:
        mask = aligned["period"] == period_label
        subset = aligned[mask].copy()
        if len(subset) < n_groups:
            # 该期跳过，累积维持不变
            for g in group_labels:
                cumulative[g].append(cumulative[g][-1])
            continue

        try:
            subset["_q"] = pd.qcut(
                subset[primary].rank(method="first"),
                n_groups,
                labels=False,
            )
        except ValueError:
            for g in group_labels:
                cumulative[g].append(cumulative[g][-1])
            continue

        for g in range(n_groups):
            grp = subset[subset["_q"] == g]
            if len(grp) > 0:
                period_ret = float(grp["forward_return"].mean())
                cumulative[group_labels[g]].append(
                    cumulative[group_labels[g]][-1] * (1.0 + period_ret),
                )
            else:
                cumulative[group_labels[g]].append(cumulative[group_labels[g]][-1])

    # 移除首元素（初始 1.0），只保留每期结束后的累积值
    result = {}
    for g in group_labels:
        vals = cumulative[g]
        if len(vals) > 1:
            # 保留完整累积曲线（含初始值）
            result[g] = [round(v, 6) for v in vals]
        else:
            result[g] = [1.0]
    return result


def _compute_correlation_matrix(
    aligned: pd.DataFrame,
    factor_labels: list[str],
) -> tuple[list[list[float]], list[str]]:
    """计算多因子的周期均值 Pearson 相关矩阵"""
    if len(factor_labels) < 1:
        return [], []

    period_means: dict[str, pd.Series] = {}
    for flabel in factor_labels:
        means = aligned.groupby("period")[flabel].mean()
        period_means[flabel] = means

    pdf = pd.DataFrame(period_means)
    if len(pdf) < 2 or len(pdf.columns) < 2:
        # 单因子或数据不足：返回 1x1 矩阵
        return [[1.0]], [factor_labels[0]]

    try:
        raw = pdf.corr(method="pearson")
        matrix: list[list[float]] = []
        for i in range(len(raw.columns)):
            row: list[float] = []
            for j in range(len(raw.columns)):
                val = raw.iloc[i, j]
                row.append(round(0.0 if (isinstance(val, float) and math.isnan(val)) else float(val), 4))
            matrix.append(row)
        return matrix, list(raw.columns)
    except Exception:
        return [[1.0]], [factor_labels[0]]


def _compute_summary(ic_series: list[dict[str, Any]]) -> dict[str, float]:
    """计算汇总统计"""
    if not ic_series:
        return {"mean_ic": 0.0, "ic_std": 0.0, "ic_ir": 0.0, "mean_rank_ic": 0.0}

    all_ics = [e["ic"] for e in ic_series]
    all_rank_ics = [e["rank_ic"] for e in ic_series]

    mean_ic = float(np.mean(all_ics))
    ic_std = float(np.std(all_ics, ddof=1)) if len(all_ics) > 1 else 0.0
    ic_ir = round(mean_ic / ic_std, 4) if ic_std > 1e-10 else 0.0

    return {
        "mean_ic": round(mean_ic, 4),
        "ic_std": round(ic_std, 4),
        "ic_ir": ic_ir,
        "mean_rank_ic": round(float(np.mean(all_rank_ics)), 4) if all_rank_ics else 0.0,
    }


def _empty_result(result_type: str) -> dict[str, Any]:
    """返回空诊断结果（数据不足时使用）"""
    return {
        "type": result_type,
        "ic_series": [],
        "layered_returns": {"Q1": [], "Q2": [], "Q3": [], "Q4": [], "Q5": []},
        "correlation_matrix": [],
        "factor_labels": [],
        "summary": {
            "mean_ic": 0.0,
            "ic_std": 0.0,
            "ic_ir": 0.0,
            "mean_rank_ic": 0.0,
        },
    }
