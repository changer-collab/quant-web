# 因子挖掘开发标准

## 1. 目录结构

```
packages/factor-lab/
  quantforge_factor/
    __init__.py       ← 公开导出
    types.py          ← FactorDefinition, FactorMetrics 等
    factor.py         ← Factor 抽象基类
    evaluator.py      ← FactorEvaluator
    your_factor.py    ← 新因子文件
  tests/
    test_your_factor.py
```

## 2. 因子基类接口

```python
from quantforge_factor import Factor, FactorDefinition
import pandas as pd

class YourFactor(Factor):
    @property
    def definition(self) -> FactorDefinition: ...
    def compute(self, df: pd.DataFrame) -> pd.Series: ...
```

## 3. FactorDefinition 规范

```python
FactorDefinition(
    id="momentum_5d",                  # 必须：snake_case，全局唯一
    name="5日动量",                     # 必须：中文展示名
    formula="close / close.shift(5) - 1",  # 必须：公式描述
    category="momentum",               # 必须：因子分类
    modes=[ResearchMode.Traditional],  # 必须：适用研究模式
    frequency=TimeFrame.D1,           # 必须：数据频率
    status=FactorStatus.Draft,        # 可选：Draft/Active/Deprecated
)
```

### category 分类

| 分类         | 说明      |
| ------------ | --------- |
| `momentum`   | 动量/反转 |
| `volatility` | 波动率    |
| `volume`     | 量价      |
| `value`      | 价值      |
| `quality`    | 质量      |
| `growth`     | 成长      |
| `technical`  | 技术指标  |
| `custom`     | 自定义    |

## 4. compute 方法规范

**输入**：`df: pd.DataFrame`，包含 `open/high/low/close/volume` 列

**输出**：`pd.Series`，与输入等长，NaN 表示无法计算

**禁止**：

- 访问数据库或网络
- 修改输入 DataFrame
- 返回不等长 Series
- 使用全局状态

## 5. 因子评估

由 `FactorEvaluator` 执行，开发者无需自己写评估逻辑。

| 指标     | 说明             | 有效阈值               |
| -------- | ---------------- | ---------------------- |
| IC       | Pearson 相关系数 | > 0.03 有效，> 0.05 强 |
| Rank IC  | Spearman 秩相关  | > IC 说明单调性好      |
| 多空收益 | 最高组 - 最低组  | > 5% 区分度高          |
| IC 胜率  | IC > 0 的比例    | > 55% 稳定             |

分层回测委托给回测引擎，不在 factor-lab 内实现。

## 6. 依赖规则

允许：`quantforge_factor`、`quantforge_strategy`（TimeFrame/ResearchMode）、`pandas`、`numpy`、标准库

禁止：`quantforge_backtest`、`services/data-center`、网络库

## 7. 测试要求

```python
def test_definition():
    f = YourFactor()
    assert f.definition.id
    assert f.definition.category
    assert f.definition.formula

def test_compute_length():
    df = pd.DataFrame({"close": np.random.randn(100) + 10})
    assert len(YourFactor().compute(df)) == len(df)

def test_compute_nan_head():
    df = pd.DataFrame({"close": [1, 2, 3]})
    result = YourFactor().compute(df)
    # 前 N 行应为 NaN
```

## 8. 示例

```python
class Momentum5dFactor(Factor):
    @property
    def definition(self):
        return FactorDefinition(
            id="momentum_5d", name="5日动量",
            formula="close / close.shift(5) - 1",
            category="momentum", modes=[ResearchMode.Traditional],
            frequency=TimeFrame.D1, status=FactorStatus.Active,
        )

    def compute(self, df):
        return df["close"] / df["close"].shift(5) - 1
```
