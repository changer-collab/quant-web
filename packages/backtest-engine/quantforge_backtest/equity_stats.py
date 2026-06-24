"""权益曲线衍生统计 — 回撤序列、月度/年度收益"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from .types import EquityPoint


@dataclass(frozen=True)
class DrawdownPoint:
    timestamp: int
    drawdown: float


@dataclass(frozen=True)
class MonthlyReturn:
    year: int
    month: int
    return_pct: float


@dataclass(frozen=True)
class AnnualReturn:
    year: int
    return_pct: float


def compute_drawdown_curve(equity_curve: list[EquityPoint]) -> list[DrawdownPoint]:
    """从权益曲线计算逐点回撤率（0 表示无回撤，负值表示回撤）

    返回负值表示回撤深度（0 = 无回撤，-0.18 = 18% 回撤），
    以匹配前端 ECharts 回撤面积图的渲染需求。
    注意：与 metrics.calc_metrics 中 max_drawdown 的正值约定相反。
    若初始权益 ≤ 0，在有正值权益出现前回撤记为 0。
    """
    if not equity_curve:
        return []
    result: list[DrawdownPoint] = []
    peak = equity_curve[0].equity
    for point in equity_curve:
        if point.equity > peak:
            peak = point.equity
        drawdown = (point.equity - peak) / peak if peak > 0 else 0.0
        result.append(DrawdownPoint(timestamp=point.timestamp, drawdown=round(drawdown, 6)))
    return result


def compute_period_returns(
    equity_curve: list[EquityPoint],
) -> tuple[list[MonthlyReturn], list[AnnualReturn]]:
    """从权益曲线计算月度和年度收益率

    按月/年分组取末尾权益，计算相邻周期收益率（百分比）。
    注意：date.fromtimestamp 使用本地时区，与数据中心 bar.timestamp 约定一致。
    """
    if len(equity_curve) < 2:
        return [], []

    monthly_last: dict[tuple[int, int], EquityPoint] = {}
    annual_last: dict[int, EquityPoint] = {}
    for point in equity_curve:
        # 时间戳可能是毫秒（13位，> 1e12）或秒（10位），统一转换为秒
        ts = point.timestamp
        if ts > 1e12:
            ts = ts / 1000
        d = date.fromtimestamp(ts)
        monthly_last[(d.year, d.month)] = point
        annual_last[d.year] = point

    monthly: list[MonthlyReturn] = []
    prev: EquityPoint | None = None
    for (year, month) in sorted(monthly_last):
        point = monthly_last[(year, month)]
        if prev is not None and prev.equity > 0:
            ret = (point.equity - prev.equity) / prev.equity * 100
            monthly.append(MonthlyReturn(year=year, month=month, return_pct=round(ret, 4)))
        prev = point

    annual: list[AnnualReturn] = []
    prev_year: EquityPoint | None = None
    for year in sorted(annual_last):
        point = annual_last[year]
        if prev_year is not None and prev_year.equity > 0:
            ret = (point.equity - prev_year.equity) / prev_year.equity * 100
            annual.append(AnnualReturn(year=year, return_pct=round(ret, 4)))
        prev_year = point

    return monthly, annual
