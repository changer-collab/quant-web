# 因子挖掘开发标准

本文档定义 QuantForge 因子开发的规范、接口约束和最佳实践。所有因子必须遵循此标准，以确保与因子评估器、回测引擎、Worker 调度链路的兼容性。

---

## 1. 目录与文件结构

因子代码位于 `packages/factor-lab/quantforge_factor/`：

```
packages/factor-lab/
  quantforge_factor/
    __init__.py       ← 公开导出
    types.py          ← 类型定义（FactorDefinition, FactorMetrics 等）
    factor.py         ← Factor 抽象基类
    evaluator.py      ← FactorEvaluator 评估器
    your_factor.py    ← 新因子文件
  tests/
    test_factor.py    ← 因子基类测试
    test_evaluator.py ← 评估器测试
    test_your_factor.py ← 新因子测试
```

---

## 2. 因子基类接口

所有因子必须继承 `quantforge_factor.Factor` 抽象基类，实现以下接口：

```python
from quantforge_factor import Factor, FactorDefinition
import pandas as pd

class YourFactor(Factor):
    @property
    def definition(self) -> FactorDefinition: ...   # 必须：因子元信息
    def compute(self, df: pd.DataFrame) -> pd.Series: ...  # 必须：计算因子值
```

---

## 3. FactorDefinition 规范

每个因子必须通过 `definition` 属性声明完整的元信息：

```python
from quantforge_factor import FactorDefinition, FactorStatus
from quantforge_strategy import TimeFrame, ResearchMode

@property
def definition(self) -> FactorDefinition:
    return FactorDefinition(
        id="momentum_5d",                  # 必须：唯一标识
        name="5日动量",                     # 必须：中文展示名
        formula="close / close.shift(5) - 1",  # 必须：公式描述
        category="momentum",               # 必须：因子分类
        modes=[ResearchMode.Traditional],   # 必须：适用研究模式
        frequency=TimeFrame.D1,            # 必须：数据频率
        status=FactorStatus.Draft,         # 可选：默认 Draft
        version="0.1.0",                   # 可选：默认 "0.1.0"
    )
```

### 3.1 id 命名规则

- 使用 `snake_case`
- 格式：`{类别}_{参数}`，如 `momentum_5d`、`volatility_20d`、`turnover_ratio`
- 全局唯一，不可与已有因子重复

### 3.2 category 分类

| 分类 | 说明 | 示例 |
|------|------|------|
| `momentum` | 动量/反转 | N日涨跌幅、相对强弱 |
| `volatility` | 波动率 | 历史波动率、ATR |
| `volume` | 量价 | 换手率、量比 |
| `value` | 价值 | PE、PB、股息率 |
| `quality` | 质量 | ROE、资产负债率 |
| `growth` | 成长 | 营收增速、利润增速 |
| `technical` | 技术指标 | RSI、MACD、布林带 |
| `custom` | 自定义 | 复合因子、AI 因子 |

### 3.3 FactorStatus

| 状态 | 值 | 含义 |
|------|------|------|
| 草稿 | `Draft` | 开发中，未验证 |
| 活跃 | `Active` | 已验证，可使用 |
| 废弃 | `Deprecated` | 已废弃，不再维护 |

### 3.4 formula 规范

- 使用 pandas 表达式语法
- 必须是可读的公式描述，不是代码
- 示例：`close / close.shift(5) - 1`、`rolling_std(close, 20) / close`

---

## 4. compute 方法规范

### 4.1 输入

`df: pd.DataFrame` — 包含以下列（由 data-client 提供）：

| 列名 | 类型 | 说明 |
|------|------|------|
| `open` | float | 开盘价 |
| `high` | float | 最高价 |
| `low` | float | 最低价 |
| `close` | float | 收盘价 |
| `volume` | float | 成交量 |

### 4.2 输出

`pd.Series` — 因子值序列，与输入 DataFrame 等长：

- NaN 表示该行无法计算（如历史数据不足）
- 值的含义必须与 `definition.formula` 一致
- 不修改输入 DataFrame

### 4.3 计算规范

```python
def compute(self, df: pd.DataFrame) -> pd.Series:
    # 1. 直接使用 df 中的列
    # 2. 返回等长 Series，不足部分自动为 NaN
    # 3. 不修改 df
    return df["close"] / df["close"].shift(5) - 1
```

### 4.4 禁止事项

- 不要在 compute 中访问数据库或网络
- 不要修改输入 DataFrame
- 不要返回与输入不等长的 Series
- 不要使用全局状态

---

## 5. 因子评估

因子评估由 `FactorEvaluator` 执行，开发者不需要自己写评估逻辑。

### 5.1 评估指标

| 指标 | 字段 | 说明 |
|------|------|------|
| IC | `metrics.ic` | Pearson 相关系数（因子值 vs 下期收益） |
| Rank IC | `metrics.rank_ic` | Spearman 秩相关系数 |
| 多空收益 | `metrics.long_short_return` | 最高组 - 最低组收益差 |
| IC 胜率 | `metrics.ic_win_rate` | IC > 0 的比例 |
| 最大回撤 | `metrics.max_drawdown` | 分组回测最大回撤 |
| 换手率 | `metrics.turnover` | 因子值变化率 |

### 5.2 评估流程

```python
from quantforge_factor import FactorEvaluator

evaluator = FactorEvaluator(n_groups=5)
result = evaluator.evaluate(
    factor=my_factor,              # Factor 实例
    df=price_df,                   # 行情 DataFrame
    forward_returns=forward_ret,   # 下期收益 Series
    evaluation_window="1y",        # 评估窗口
)

print(result.metrics.ic)           # IC 值
print(result.metrics.rank_ic)      # Rank IC
```

### 5.3 分组收益

`FactorEvaluator` 按因子值将标的分为 N 组（默认 5 组），计算每组平均收益：

```python
group_returns = evaluator.calc_group_returns(factor_values, forward_returns)
# {"group_0": -0.02, "group_1": 0.01, ..., "group_4": 0.05}
```

### 5.4 分层回测

分层回测（按因子分组后回测每组策略表现）委托给回测引擎执行，不在 factor-lab 内实现。

### 5.5 评估结果解读

| 指标范围 | 评价 |
|----------|------|
| IC > 0.03 | 有效因子 |
| IC > 0.05 | 强因子 |
| Rank IC > IC | 因子单调性好 |
| 多空收益 > 5% | 分组区分度高 |
| IC 胜率 > 55% | 信号稳定 |

---

## 6. 依赖规则

### 6.1 允许的依赖

```
packages/factor-lab → packages/strategy-runtime（TimeFrame, ResearchMode）
packages/factor-lab → packages/data-client（Bar 等行情类型，通过 compute 输入传入）
```

因子代码只能 import 以下包：
- `quantforge_factor`（自身包）
- `quantforge_strategy`（TimeFrame, ResearchMode 等枚举）
- `pandas`、`numpy`（计算库）
- Python 标准库

### 6.2 禁止依赖

- `quantforge_backtest`（回测引擎 — 评估由 FactorEvaluator 内部调用）
- `services/data-center`
- 任何需要网络连接的库

---

## 7. 测试要求

每个因子必须包含单元测试，放在 `packages/factor-lab/tests/` 下：

### 7.1 必测项

```python
# test_your_factor.py
import pandas as pd
import numpy as np
from quantforge_factor import FactorDefinition, FactorStatus
from your_factor import YourFactor

def test_definition():
    """验证因子元信息完整性"""
    f = YourFactor()
    assert f.definition.id == "your_factor"
    assert f.definition.category
    assert f.definition.formula
    assert f.definition.status in (FactorStatus.Draft, FactorStatus.Active)

def test_compute_length():
    """验证输出与输入等长"""
    f = YourFactor()
    df = pd.DataFrame({"close": np.random.randn(100) + 10})
    result = f.compute(df)
    assert len(result) == len(df)

def test_compute_nan_head():
    """验证历史不足时返回 NaN"""
    f = YourFactor()
    df = pd.DataFrame({"close": [1, 2, 3]})
    result = f.compute(df)
    # 前 N 行应为 NaN（取决于因子所需历史长度）
```

### 7.2 建议测试项

- 已知值验证（构造简单输入，验证计算结果）
- 全 NaN 输入处理
- 单行数据处理
- 极端值处理（0、负数、极大值）
- 评估器集成测试（compute → evaluate 完整流程）

---

## 8. 完整示例

### 8.1 动量因子

```python
"""5日动量因子"""

from __future__ import annotations

import pandas as pd

from quantforge_factor import Factor, FactorDefinition, FactorStatus
from quantforge_strategy import TimeFrame, ResearchMode


class Momentum5dFactor(Factor):
    """5日动量：当前收盘价相对5日前收盘价的涨跌幅"""

    @property
    def definition(self) -> FactorDefinition:
        return FactorDefinition(
            id="momentum_5d",
            name="5日动量",
            formula="close / close.shift(5) - 1",
            category="momentum",
            modes=[ResearchMode.Traditional],
            frequency=TimeFrame.D1,
            status=FactorStatus.Active,
            version="0.1.0",
        )

    def compute(self, df: pd.DataFrame) -> pd.Series:
        return df["close"] / df["close"].shift(5) - 1
```

### 8.2 波动率因子

```python
"""20日波动率因子"""

from __future__ import annotations

import pandas as pd

from quantforge_factor import Factor, FactorDefinition, FactorStatus
from quantforge_strategy import TimeFrame, ResearchMode


class Volatility20dFactor(Factor):
    """20日收益率标准差，年化"""

    @property
    def definition(self) -> FactorDefinition:
        return FactorDefinition(
            id="volatility_20d",
            name="20日波动率",
            formula="rolling_std(close.pct_change(), 20) * sqrt(252)",
            category="volatility",
            modes=[ResearchMode.Traditional],
            frequency=TimeFrame.D1,
            status=FactorStatus.Draft,
            version="0.1.0",
        )

    def compute(self, df: pd.DataFrame) -> pd.Series:
        returns = df["close"].pct_change()
        return returns.rolling(20).std() * (252 ** 0.5)
```

### 8.3 复合因子

```python
"""动量-波动率复合因子"""

from __future__ import annotations

import pandas as pd

from quantforge_factor import Factor, FactorDefinition, FactorStatus
from quantforge_strategy import TimeFrame, ResearchMode


class MomentumVolFactor(Factor):
    """动量除以波动率，类似风险调整收益"""

    @property
    def definition(self) -> FactorDefinition:
        return FactorDefinition(
            id="momentum_vol",
            name="动量-波动率",
            formula="(close / close.shift(20) - 1) / rolling_std(close.pct_change(), 20)",
            category="custom",
            modes=[ResearchMode.Traditional],
            frequency=TimeFrame.D1,
            status=FactorStatus.Draft,
            version="0.1.0",
        )

    def compute(self, df: pd.DataFrame) -> pd.Series:
        momentum = df["close"] / df["close"].shift(20) - 1
        volatility = df["close"].pct_change().rolling(20).std()
        return momentum / volatility.replace(0, float("nan"))
```

---

## 9. 因子与策略的关系

### 9.1 因子是策略的输入维度

策略通过 `meta.required_factors` 声明依赖的因子：

```python
class MyStrategy(Strategy):
    @property
    def meta(self) -> StrategyMeta:
        return StrategyMeta(
            name="factor_momentum",
            required_factors=["momentum_5d", "volatility_20d"],
            ...
        )
```

### 9.2 数据流

```
data-client → DataFrame → Factor.compute() → Series → 策略 on_bar()
```

### 9.3 评估委托

因子评估指标（IC、分组收益、分层回测）的计算委托给回测引擎，factor-lab 只定义接口和调度。

---

## 10. 常见问题

### Q: 因子可以使用基本面数据吗？
当前 `compute` 输入只有 OHLCV 行情数据。基本面因子需要等 data-center 扩展基本面 Provider 后支持。

### Q: 因子可以依赖其他因子吗？
可以。在 `compute` 中先计算依赖因子的值，再组合。但建议将复合因子作为独立因子，在 formula 中说明依赖关系。

### Q: 如何判断因子是否有效？
IC > 0.03 且 Rank IC > IC 通常意味着因子有预测能力。同时关注多空收益和 IC 胜率的稳定性。

### Q: 因子评估和回测有什么区别？
因子评估关注因子值的统计特性（IC、分组收益），回测关注使用因子构建策略后的实际交易表现。因子评估是回测的前置筛选。

### Q: compute 方法可以返回 DataFrame 吗？
不可以。`compute` 必须返回 `pd.Series`，每个值对应一个时间点的因子值。如果需要多列输出，请拆分为多个因子。
