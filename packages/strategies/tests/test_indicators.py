"""技术指标库测试"""

import math

from quantforge_strategies.indicators import (
    sma, ema, rsi, macd, kdj, bollinger,
    crossover, crossunder, last_valid, NaN,
)


def test_sma_basic():
    values = [1.0, 2.0, 3.0, 4.0, 5.0]
    result = sma(values, 3)
    assert len(result) == 5
    assert result[0] != result[0]  # NaN
    assert result[1] != result[1]  # NaN
    assert result[2] == 2.0  # (1+2+3)/3
    assert result[3] == 3.0  # (2+3+4)/3
    assert result[4] == 4.0  # (3+4+5)/3


def test_sma_insufficient_data():
    result = sma([1.0, 2.0], 5)
    assert all(v != v for v in result)


def test_sma_invalid_period():
    try:
        sma([1.0], 0)
        assert False, "should raise"
    except ValueError:
        pass


def test_ema_basic():
    values = [10.0, 10.0, 10.0, 20.0]
    result = ema(values, 3)
    # 前 2 个为 NaN
    assert result[0] != result[0]
    assert result[1] != result[1]
    # 第 3 个为前 3 个值的 SMA = 10
    assert result[2] == 10.0
    # 第 4 个：alpha = 2/4 = 0.5, EMA = 0.5*20 + 0.5*10 = 15
    assert result[3] == 15.0


def test_ema_insufficient_data():
    result = ema([1.0, 2.0], 5)
    assert all(v != v for v in result)


def test_rsi_all_gains():
    # 价格持续上涨，RSI 应为 100
    values = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
    result = rsi(values, 5)
    assert result[5] == 100.0


def test_rsi_all_losses():
    # 价格持续下跌，RSI 应为 0
    values = [6.0, 5.0, 4.0, 3.0, 2.0, 1.0]
    result = rsi(values, 5)
    assert result[5] == 0.0


def test_rsi_insufficient_data():
    result = rsi([1.0, 2.0], 5)
    assert all(v != v for v in result)


def test_macd_basic():
    # 构造一段先涨后跌的价格，下跌段足够长让 EMA 反应过来
    values = [10.0 + i for i in range(30)] + [40.0 - i for i in range(1, 30)]
    dif, dea, hist = macd(values, 12, 26, 9)
    assert len(dif) == len(values)
    assert len(dea) == len(values)
    assert len(hist) == len(values)
    # 前 25 个 dif 为 NaN（slow_period - 1 = 25）
    assert dif[24] != dif[24]
    # dif 在上涨阶段应为正
    assert dif[29] > 0
    # 下跌阶段足够长后 dif 应转负
    assert dif[-1] < 0


def test_macd_insufficient_data():
    dif, dea, hist = macd([1.0, 2.0], 12, 26, 9)
    assert all(v != v for v in dif)
    assert all(v != v for v in dea)
    assert all(v != v for v in hist)


def test_kdj_basic():
    highs = [10.0, 11.0, 12.0, 11.0, 10.0]
    lows = [9.0, 10.0, 11.0, 10.0, 9.0]
    closes = [9.5, 10.5, 11.5, 10.5, 9.5]
    k, d, j = kdj(highs, lows, closes, 3)
    assert len(k) == 5
    assert len(d) == 5
    assert len(j) == 5
    # 前 2 个为 NaN
    assert k[0] != k[0]
    assert k[1] != k[1]
    # 第 3 个开始有效
    assert k[2] == k[2]  # not NaN
    assert d[2] == d[2]
    assert j[2] == 3 * k[2] - 2 * d[2]


def test_kdj_flat_market():
    # 价格不变，RSV 应为 50
    highs = [10.0] * 5
    lows = [10.0] * 5
    closes = [10.0] * 5
    k, d, j = kdj(highs, lows, closes, 3)
    # 当 highest == lowest，rsv = 50
    # k = 2/3 * 50 + 1/3 * 50 = 50（浮点精度内）
    assert abs(k[2] - 50.0) < 1e-9


def test_kdj_length_mismatch():
    try:
        kdj([1.0, 2.0], [1.0], [1.0, 2.0], 3)
        assert False, "should raise"
    except ValueError:
        pass


def test_bollinger_basic():
    values = [10.0] * 20 + [20.0]
    middle, upper, lower = bollinger(values, 20, 2.0)
    assert len(middle) == 21
    # 前 19 个为 NaN
    assert middle[18] != middle[18]
    # 第 20 个为前 20 个值的均值 = 10
    assert middle[19] == 10.0
    # 标准差为 0，upper == lower == middle
    assert upper[19] == 10.0
    assert lower[19] == 10.0


def test_bollinger_with_volatility():
    values = [8.0, 12.0] * 10 + [10.0]
    middle, upper, lower = bollinger(values, 20, 2.0)
    assert middle[19] == 10.0  # 均值
    assert upper[19] > middle[19]
    assert lower[19] < middle[19]


def test_bollinger_insufficient_data():
    middle, upper, lower = bollinger([1.0, 2.0], 20, 2.0)
    assert all(v != v for v in middle)
    assert all(v != v for v in upper)
    assert all(v != v for v in lower)


def test_crossover_basic():
    a = [1.0, 2.0, 3.0, 2.0]
    b = [2.0, 2.0, 2.0, 2.0]
    result = crossover(a, b)
    # 在索引 2 处 a 从 2 上穿到 3，b 保持 2
    assert result[2] is True
    assert result[0] is False
    assert result[1] is False
    assert result[3] is False


def test_crossover_no_cross():
    a = [1.0, 1.0, 1.0]
    b = [2.0, 2.0, 2.0]
    result = crossover(a, b)
    assert all(v is False for v in result)


def test_crossunder_basic():
    a = [3.0, 2.0, 1.0, 2.0]
    b = [2.0, 2.0, 2.0, 2.0]
    result = crossunder(a, b)
    # 在索引 2 处 a 从 2 下穿到 1
    assert result[2] is True
    assert result[0] is False


def test_crossover_with_nan():
    a = [NaN, 1.0, 3.0]
    b = [2.0, 2.0, 2.0]
    result = crossover(a, b)
    # 索引 0 的 a 是 NaN，索引 1 a=1 <= b=2，索引 2 a=3 > b=2
    # 但 prev_a (索引 1) = 1 <= prev_b = 2，cur_a = 3 > cur_b = 2 → 上穿
    assert result[2] is True


def test_last_valid_basic():
    values = [NaN, 1.0, NaN, 2.0, NaN]
    assert last_valid(values) == 2.0


def test_last_valid_all_nan():
    values = [NaN, NaN]
    assert last_valid(values) is None


def test_last_valid_empty():
    assert last_valid([]) is None
