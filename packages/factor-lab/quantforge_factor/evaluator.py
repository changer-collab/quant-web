"""因子评估器 — IC、Rank IC、分组收益；分层回测委托 backtest-engine"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .types import FactorMetrics, FactorEvaluationResult, FactorEvalTab
from .factor import Factor


class FactorEvaluator:
    """因子评估器"""

    def __init__(self, n_groups: int = 5) -> None:
        self.n_groups = n_groups

    def calc_ic(self, factor_values: pd.Series, forward_returns: pd.Series) -> float:
        """计算 IC（Pearson 相关系数）"""
        valid = factor_values.notna() & forward_returns.notna()
        if valid.sum() < 2:
            return 0.0
        return float(factor_values[valid].corr(forward_returns[valid]))

    def calc_rank_ic(self, factor_values: pd.Series, forward_returns: pd.Series) -> float:
        """计算 Rank IC（Spearman 秩相关系数）"""
        valid = factor_values.notna() & forward_returns.notna()
        if valid.sum() < 2:
            return 0.0
        return float(factor_values[valid].corr(forward_returns[valid], method="spearman"))

    def calc_group_returns(
        self, factor_values: pd.Series, forward_returns: pd.Series,
    ) -> dict[str, float]:
        """按因子值分组计算收益"""
        valid = factor_values.notna() & forward_returns.notna()
        if valid.sum() < self.n_groups:
            return {}
        fv = factor_values[valid]
        fr = forward_returns[valid]
        labels = pd.qcut(fv, self.n_groups, labels=False, duplicates="drop")
        result = {}
        for g in range(self.n_groups):
            mask = labels == g
            if mask.any():
                result[f"group_{g}"] = float(fr[mask].mean())
        return result

    def evaluate(
        self,
        factor: Factor,
        df: pd.DataFrame,
        forward_returns: pd.Series,
        evaluation_window: str = "1y",
    ) -> FactorEvaluationResult:
        """完整因子评估"""
        factor_values = factor.compute(df)

        ic = self.calc_ic(factor_values, forward_returns)
        rank_ic = self.calc_rank_ic(factor_values, forward_returns)

        group_returns = self.calc_group_returns(factor_values, forward_returns)
        long_short = 0.0
        if group_returns:
            sorted_groups = sorted(group_returns.values())
            if len(sorted_groups) >= 2:
                long_short = sorted_groups[-1] - sorted_groups[0]

        # IC 胜率
        ic_win_rate = 0.0
        if len(factor_values) > 1:
            ic_positive = (factor_values * forward_returns > 0).sum()
            ic_win_rate = float(ic_positive / len(factor_values))

        metrics = FactorMetrics(
            ic=round(ic, 4),
            rank_ic=round(rank_ic, 4),
            long_short_return=round(long_short, 4),
            ic_win_rate=round(ic_win_rate, 4),
        )

        return FactorEvaluationResult(
            factor_id=factor.definition.id,
            evaluation_window=evaluation_window,
            active_tab=FactorEvalTab.ICAnalysis,
            metrics=metrics,
        )
