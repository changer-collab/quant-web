"""过渡形态策略诊断 — 情感衰减曲线 / 目标因子映射 / 异常检测

根据 params 中的 configSnapshot 读取配置：
1. 从价格波动率代理情感得分（sentiment proxy via risk-adjusted return）
2. 指数衰减加权情感曲线（EWM span = half_life）
3. 异常检测（z-score > 3σ 标记为 outlier）
4. 情感与目标因子池各因子的 Spearman 相关性映射
5. 映射验证（最大 |ρ| > 0.1 → validation_passed）

数据不足时返回空结构并 emit warning，不崩溃。
"""

from __future__ import annotations

import math
from typing import Any, Callable

import numpy as np
import pandas as pd


# ========================================================================
# 默认因子公式映射（与 factor.py 一致，用于情感因子映射）
# ========================================================================
_DEFAULT_FACTOR_FORMULAS: dict[str, str] = {
    "ep": "close / open",
    "bp": "close / open",
    "mom": "close / shift(close, 20)",
    "size": "log(volume)",
    "vol": "rolling_std(close, 20)",
    "turn": "rolling_mean(volume, 20)",
    "roe": "close / shift(close, 5)",
    "reversal": "close / shift(close, 5)",
}


# ========================================================================
# 主诊断类
# ========================================================================


class DiagnosticsTransitional:
    """过渡形态策略诊断 — 情感衰减曲线 + 目标因子映射"""

    @staticmethod
    def run(
        params: dict[str, Any],
        emit: Callable[[str, dict], None] | None = None,
    ) -> dict[str, Any]:
        """运行过渡形态诊断

        参数:
            params: dict
                - symbol / timeframe / dataRange: 数据加载参数
                - configSnapshot: {strategy, params} 含情感衰减配置和目标因子池
                - _bars_df: 测试用预加载 DataFrame（非 None 时跳过 DataClient）
            emit: NDJSON 事件发射器

        返回:
            dict — type='transitional' 的诊断结果
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

        # ── 4. 提取配置参数 ──────────────────────────────────────────────
        config_params = config_snapshot.get("params", {})
        half_life = int(config_params.get("sentiment_decay_half_life", 5))
        target_factor_pool: list[str] = config_params.get("target_factor_pool", ["mom"])
        data_source = config_params.get("dataSource", "")

        if half_life < 1:
            half_life = 1

        _emit("log", {"level": "info", "message": f"半衰期: {half_life}天, 目标因子: {target_factor_pool}"})

        # ── 5. 计算原始情感得分 ──────────────────────────────────────────
        # 支持 event sentiment data source（预留接口）
        # 当前实现：用价格波动率代理情感得分
        if data_source:
            _emit("log", {
                "level": "info",
                "message": f"dataSource='{data_source}' specified, "
                           f"using price volatility proxy (event sentiment not yet available)",
            })

        # 计算日收益率
        returns = bars_df["close"].pct_change().fillna(0.0)
        # 滚动波动率（5 期滚动标准差）
        lookback = min(5, max(2, len(returns) // 10))
        rolling_vol = returns.rolling(window=lookback).std().replace(0.0, np.nan)
        # 风险调整收益率作为情感得分（上涨趋势正情感 / 下跌趋势负情感）
        raw_sentiment = returns / rolling_vol
        raw_sentiment = raw_sentiment.fillna(0.0).replace([np.inf, -np.inf], 0.0)

        # 标准化为 z-score（零均值、单位方差）
        mean_s = raw_sentiment.mean()
        std_s = raw_sentiment.std()
        if std_s > 1e-10:
            sentiment = (raw_sentiment - mean_s) / std_s
        else:
            sentiment = pd.Series(np.zeros(len(raw_sentiment)), index=raw_sentiment.index)

        # 裁剪极端值，避免 outlier 检测被少数极端值主导
        sentiment = sentiment.clip(-5, 5)

        # ── 6. 指数衰减 —— EWM 平滑 ────────────────────────────────────
        # 以半衰期为 span 进行指数加权移动平均
        # half_life 越小 → 衰减越快 → 更敏感；half_life 越大 → 更平滑
        span = max(half_life, 1)
        decayed_sentiment = sentiment.ewm(span=span, adjust=False).mean()

        # 衰减后重新 z-score 归一化
        mean_d = decayed_sentiment.mean()
        std_d = decayed_sentiment.std()
        if std_d > 1e-10:
            decayed = (decayed_sentiment - mean_d) / std_d
        else:
            decayed = pd.Series(np.zeros(len(decayed_sentiment)), index=decayed_sentiment.index)
        decayed = decayed.clip(-3, 3)

        _emit("log", {"level": "info", "message": f"情感衰减完成, span={span}"})

        # ── 7. 异常检测 ──────────────────────────────────────────────
        # z-score > 3σ 标记为 outlier
        dz_mean = float(decayed.mean())
        dz_std = float(decayed.std()) if float(decayed.std()) > 1e-10 else 1.0
        z_scores = np.abs(decayed.values - dz_mean) / dz_std
        outlier_count = int(np.sum(z_scores > 3.0))
        _emit("log", {"level": "info", "message": f"异常检测: {outlier_count}/{len(bars_df)} 个 outlier"})

        # ── 8. 构建情感曲线 ──────────────────────────────────────────
        # 直接用原始时间戳列（避免 _parse_dates 转换为 Timestamp 对象）
        if "timestamp" in bars_df.columns:
            ts_series = bars_df["timestamp"]
        else:
            # 无时间戳则用行号
            ts_series = pd.Series(range(len(bars_df)), index=bars_df.index)

        sentiment_curve: list[dict[str, Any]] = []
        for i in range(len(bars_df)):
            ts_raw = ts_series.iloc[i]
            ts_val = int(ts_raw) if not (isinstance(ts_raw, pd.Timestamp)) else int(ts_raw.timestamp())
            score_val = float(decayed.iloc[i]) if isinstance(decayed, pd.Series) else float(decayed[i])
            if not math.isnan(score_val) and not math.isinf(score_val):
                sentiment_curve.append({"ts": ts_val, "score": round(score_val, 6)})

        _emit("log", {"level": "info", "message": f"情感曲线: {len(sentiment_curve)} 个有效点"})

        # ── 9. 目标因子映射 ──────────────────────────────────────────
        mapping_metrics = _compute_factor_mapping(
            bars_df, decayed, target_factor_pool, _emit,
        )
        _emit("log", {"level": "info", "message": f"因子映射: {len(mapping_metrics)} 个因子"})

        # ── 10. 映射验证 ─────────────────────────────────────────────
        validation_passed = False
        if mapping_metrics:
            max_corr = max(abs(v) for v in mapping_metrics.values())
            validation_passed = max_corr > 0.1

        _emit("log", {
            "level": "info",
            "message": f"过渡诊断完成: {len(sentiment_curve)} 点, "
                       f"outlier={outlier_count}, 映射={len(mapping_metrics)}, "
                       f"validated={'是' if validation_passed else '否'}",
        })

        return {
            "type": "transitional",
            "sentiment_curve": sentiment_curve,
            "mapping_metrics": mapping_metrics,
            "outlier_count": outlier_count,
            "validation_passed": validation_passed,
        }


# ========================================================================
# 内部函数
# ========================================================================


def _empty_result() -> dict[str, Any]:
    """返回空诊断结果（数据不足时使用）"""
    return {
        "type": "transitional",
        "sentiment_curve": [],
        "mapping_metrics": {},
        "outlier_count": 0,
        "validation_passed": False,
    }


def _parse_dates(bars_df: pd.DataFrame) -> pd.Series:
    """从 DataFrame 解析日期序列（兼容多种格式）"""
    if "timestamp" in bars_df.columns:
        sample = bars_df["timestamp"].iloc[0] if len(bars_df) > 0 else None
        if sample is not None and isinstance(sample, (int, float, np.integer, np.floating)):
            # 自动检测时间戳分辨率：秒 / 毫秒 / 微秒
            if sample > 1e15:  # 微秒→转秒
                return pd.to_datetime(bars_df["timestamp"] / 1_000_000, unit="s")
            if sample > 1e11:  # 毫秒→转秒
                return pd.to_datetime(bars_df["timestamp"] / 1000, unit="s")
            return pd.to_datetime(bars_df["timestamp"], unit="s")
        return pd.to_datetime(bars_df["timestamp"])
    # 没有 timestamp 列则用 index
    return pd.to_datetime(bars_df.index)


def _build_factor_defs(factor_ids: list[str]) -> list[dict[str, str]]:
    """从因子 ID 列表构建因子定义列表"""
    if not factor_ids:
        return []

    defs: list[dict[str, str]] = []
    for fid in factor_ids:
        formula = _DEFAULT_FACTOR_FORMULAS.get(fid)
        if formula:
            defs.append({"id": fid, "formula": formula})
    return defs


def _compute_factor_mapping(
    bars_df: pd.DataFrame,
    sentiment_series: pd.Series,
    target_factor_pool: list[str],
    emit: Callable[[str, dict], None],
) -> dict[str, float]:
    """计算情感得分与目标因子的 Spearman 相关性

    对 target_factor_pool 中的每个因子 ID：
    1. 通过 FormulaFactor 计算因子值序列
    2. 与情感得分序列对齐（dropna）
    3. 计算 Spearman 秩相关系数

    返回:
        {factor_id: spearman_rho, ...}
        因子计算失败时该因子不出现（不抛异常）
    """
    if not target_factor_pool or len(bars_df) < 20:
        return {}

    factor_defs = _build_factor_defs(target_factor_pool)
    if not factor_defs:
        return {}

    metrics: dict[str, float] = {}
    aligned_sentiment = sentiment_series.reset_index(drop=True)

    for fdef in factor_defs:
        formula = fdef.get("formula", "")
        label = fdef.get("id", "")
        if not formula or not label:
            continue

        try:
            from quantforge_factor import FormulaFactor

            factor = FormulaFactor(formula)
            factor_values = factor.compute(bars_df)

            # 对齐情感序列和因子值序列
            n_min = min(len(aligned_sentiment), len(factor_values))
            combined = pd.DataFrame({
                "sentiment": aligned_sentiment.iloc[:n_min].values,
                "factor": factor_values.iloc[:n_min].values if hasattr(factor_values, 'iloc') else factor_values[:n_min],
            }).dropna().replace([np.inf, -np.inf], np.nan).dropna()

            if len(combined) < 10:
                emit("log", {"level": "info", "message": f"  因子 {label}: 有效数据不足 {len(combined)} < 10"})
                continue

            # Spearman 秩相关
            rho = combined["sentiment"].corr(combined["factor"], method="spearman")
            if not (isinstance(rho, float) and math.isnan(rho)):
                metrics[label] = round(float(rho), 4)
                emit("log", {
                    "level": "info",
                    "message": f"  因子 {label}: Spearman ρ={float(rho):.4f} ({len(combined)} 样本)",
                })
        except Exception as exc:
            emit("log", {"level": "warn", "message": f"  因子 {label} 映射失败: {exc}"})

    return metrics
