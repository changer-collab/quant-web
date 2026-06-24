"""技术指标库 — 通用指标计算，供策略复用

借鉴 OSkhQuant MyTT.py 的设计思路：提供无状态的指标函数，
策略通过组合这些函数实现交易逻辑，避免重复造轮子。

设计原则：
- 纯函数，无副作用，便于测试
- 接受 list[float] 输入，返回 list[float]（长度与输入对齐，前置不足部分用 NaN 或 None）
- 不依赖外部库，仅用标准库 math
"""

from __future__ import annotations

import math
from typing import List, Optional

NaN = float("nan")


def sma(values: List[float], period: int) -> List[float]:
    """简单移动平均

    Args:
        values: 价格序列
        period: 计算周期

    Returns:
        与 values 等长的列表，前 period-1 个为 NaN，之后为对应周期的均值
    """
    if period <= 0:
        raise ValueError("period must be positive")
    n = len(values)
    out: List[float] = [NaN] * n
    if n < period:
        return out
    window_sum = sum(values[:period])
    out[period - 1] = window_sum / period
    for i in range(period, n):
        window_sum += values[i] - values[i - period]
        out[i] = window_sum / period
    return out


def ema(values: List[float], period: int) -> List[float]:
    """指数移动平均

    Args:
        values: 价格序列
        period: 计算周期

    Returns:
        与 values 等长的列表，首个有效值在 period-1 处（用前 period 个值的 SMA 作为种子）
    """
    if period <= 0:
        raise ValueError("period must be positive")
    n = len(values)
    out: List[float] = [NaN] * n
    if n < period:
        return out
    alpha = 2.0 / (period + 1)
    # 用前 period 个值的 SMA 作为 EMA 种子
    seed = sum(values[:period]) / period
    out[period - 1] = seed
    for i in range(period, n):
        out[i] = alpha * values[i] + (1 - alpha) * out[i - 1]
    return out


def rsi(values: List[float], period: int) -> List[float]:
    """相对强弱指标

    Args:
        values: 价格序列
        period: 计算周期

    Returns:
        与 values 等长的列表，前 period 个为 NaN，之后为 RSI 值（0-100）
    """
    if period <= 0:
        raise ValueError("period must be positive")
    n = len(values)
    out: List[float] = [NaN] * n
    if n < period + 1:
        return out

    gains: List[float] = [0.0] * n
    losses: List[float] = [0.0] * n
    for i in range(1, n):
        change = values[i] - values[i - 1]
        gains[i] = max(change, 0.0)
        losses[i] = max(-change, 0.0)

    # 首个 avg_gain/avg_loss 用前 period 个差值的简单平均
    avg_gain = sum(gains[1:period + 1]) / period
    avg_loss = sum(losses[1:period + 1]) / period
    if avg_loss == 0:
        out[period] = 100.0
    else:
        rs = avg_gain / avg_loss
        out[period] = 100.0 - (100.0 / (1.0 + rs))

    # 后续使用 Wilder 平滑
    for i in range(period + 1, n):
        avg_gain = (avg_gain * (period - 1) + gains[i]) / period
        avg_loss = (avg_loss * (period - 1) + losses[i]) / period
        if avg_loss == 0:
            out[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            out[i] = 100.0 - (100.0 / (1.0 + rs))
    return out


def macd(
    values: List[float],
    fast_period: int = 12,
    slow_period: int = 26,
    signal_period: int = 9,
) -> tuple[List[float], List[float], List[float]]:
    """MACD 指标

    Args:
        values: 价格序列
        fast_period: 快线 EMA 周期
        slow_period: 慢线 EMA 周期
        signal_period: 信号线 EMA 周期

    Returns:
        (dif, dea, hist) 三元组，均为与 values 等长的列表
        dif = ema(fast) - ema(slow)
        dea = ema(dif, signal_period)
        hist = (dif - dea) * 2  # 国内惯例乘 2
    """
    ema_fast = ema(values, fast_period)
    ema_slow = ema(values, slow_period)
    n = len(values)
    dif: List[float] = [NaN] * n
    for i in range(n):
        if ema_fast[i] != ema_fast[i] or ema_slow[i] != ema_slow[i]:
            continue
        dif[i] = ema_fast[i] - ema_slow[i]

    # 对 dif 的有效部分做 EMA
    dea: List[float] = [NaN] * n
    if n >= slow_period + signal_period - 1:
        # 找到 dif 第一个有效值的索引
        first_valid = slow_period - 1
        if first_valid < n:
            valid_dif = dif[first_valid:]
            if len(valid_dif) >= signal_period:
                alpha = 2.0 / (signal_period + 1)
                seed = sum(valid_dif[:signal_period]) / signal_period
                dea[first_valid + signal_period - 1] = seed
                for i in range(first_valid + signal_period, n):
                    dea[i] = alpha * dif[i] + (1 - alpha) * dea[i - 1]

    hist: List[float] = [NaN] * n
    for i in range(n):
        if dif[i] != dif[i] or dea[i] != dea[i]:
            continue
        hist[i] = (dif[i] - dea[i]) * 2.0
    return dif, dea, hist


def kdj(
    highs: List[float],
    lows: List[float],
    closes: List[float],
    period: int = 9,
) -> tuple[List[float], List[float], List[float]]:
    """KDJ 随机指标

    Args:
        highs: 最高价序列
        lows: 最低价序列
        closes: 收盘价序列
        period: RSV 计算周期

    Returns:
        (k, d, j) 三元组，均为与输入等长的列表
        RSV = (close - lowest_low) / (highest_high - lowest_low) * 100
        K = 2/3 * prev_K + 1/3 * RSV
        D = 2/3 * prev_D + 1/3 * K
        J = 3 * K - 2 * D
    """
    n = len(closes)
    if not (len(highs) == len(lows) == n):
        raise ValueError("highs, lows, closes must have same length")
    if period <= 0:
        raise ValueError("period must be positive")

    k: List[float] = [NaN] * n
    d: List[float] = [NaN] * n
    j: List[float] = [NaN] * n
    if n < period:
        return k, d, j

    prev_k = 50.0
    prev_d = 50.0
    for i in range(period - 1, n):
        highest = max(highs[i - period + 1:i + 1])
        lowest = min(lows[i - period + 1:i + 1])
        if highest == lowest:
            rsv = 50.0
        else:
            rsv = (closes[i] - lowest) / (highest - lowest) * 100.0
        prev_k = (2.0 / 3.0) * prev_k + (1.0 / 3.0) * rsv
        prev_d = (2.0 / 3.0) * prev_d + (1.0 / 3.0) * prev_k
        k[i] = prev_k
        d[i] = prev_d
        j[i] = 3.0 * prev_k - 2.0 * prev_d
    return k, d, j


def bollinger(
    values: List[float],
    period: int = 20,
    num_std: float = 2.0,
) -> tuple[List[float], List[float], List[float]]:
    """布林带

    Args:
        values: 价格序列
        period: 计算周期
        num_std: 标准差倍数

    Returns:
        (middle, upper, lower) 三元组，均为与 values 等长的列表
        middle = SMA(period)
        upper = middle + num_std * std
        lower = middle - num_std * std
    """
    if period <= 0:
        raise ValueError("period must be positive")
    n = len(values)
    middle: List[float] = [NaN] * n
    upper: List[float] = [NaN] * n
    lower: List[float] = [NaN] * n
    if n < period:
        return middle, upper, lower

    for i in range(period - 1, n):
        window = values[i - period + 1:i + 1]
        m = sum(window) / period
        variance = sum((x - m) ** 2 for x in window) / period
        std = math.sqrt(variance)
        middle[i] = m
        upper[i] = m + num_std * std
        lower[i] = m - num_std * std
    return middle, upper, lower


def crossover(a: List[float], b: List[float]) -> List[bool]:
    """判断 a 是否上穿 b（金叉）

    Args:
        a: 序列 a
        b: 序列 b

    Returns:
        与输入等长的布尔列表，True 表示该位置发生上穿
    """
    n = len(a)
    if len(b) != n:
        raise ValueError("a and b must have same length")
    out: List[bool] = [False] * n
    for i in range(1, n):
        prev_a, prev_b = a[i - 1], b[i - 1]
        cur_a, cur_b = a[i], b[i]
        # 跳过 NaN
        if prev_a != prev_a or prev_b != prev_b or cur_a != cur_a or cur_b != cur_b:
            continue
        if prev_a <= prev_b and cur_a > cur_b:
            out[i] = True
    return out


def crossunder(a: List[float], b: List[float]) -> List[bool]:
    """判断 a 是否下穿 b（死叉）

    Args:
        a: 序列 a
        b: 序列 b

    Returns:
        与输入等长的布尔列表，True 表示该位置发生下穿
    """
    n = len(a)
    if len(b) != n:
        raise ValueError("a and b must have same length")
    out: List[bool] = [False] * n
    for i in range(1, n):
        prev_a, prev_b = a[i - 1], b[i - 1]
        cur_a, cur_b = a[i], b[i]
        if prev_a != prev_a or prev_b != prev_b or cur_a != cur_a or cur_b != cur_b:
            continue
        if prev_a >= prev_b and cur_a < cur_b:
            out[i] = True
    return out


def last_valid(values: List[float]) -> Optional[float]:
    """取序列中最后一个非 NaN 值"""
    for v in reversed(values):
        if v == v:  # not NaN
            return v
    return None
