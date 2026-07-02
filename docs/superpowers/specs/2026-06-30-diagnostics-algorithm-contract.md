# 诊断算法契约 — Phase 0 冻结版本

> **状态：已冻结。** 本文定义三类策略诊断算法的输入、输出、错误码与最小算法规则，作为 Phase 6 算法实现与 Phase 1 结果信封类型的契约来源。
> 后续任何修改需要更新本文档中的字段定义并记录在 Doc Sync Log 中。

---

## 0. 文档治理

### 0.1 本文件何时更新

- diagnostics 算法输出的字段名、类型、嵌套结构发生变化时
- 错误码集或触发条件发生变化时
- 数据输入来源变更时
- synthetic diagnostics 的开关策略发生变化时

简单的实现优化（如计算精度调整、算法路径优化）不需要更新本文档。

### 0.2 Doc Sync Log

| Date       | Change                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| 2026-06-30 | v1 冻结 — 基于 factor.py / non_factor.py 真实实现 + transitional.py 契约定义 |

---

## 1. 全局约定

### 1.1 统一响应格式

所有诊断算法返回统一的 dict 结构：

```python
{
    "ok": bool,              # 整体成功/失败
    "data": dict | None,     # 成功时的诊断结果（含 type 字段）
    "error": dict | None,    # 失败时的错误信息（含 code / message）
}
```

诊断结果 `data` 中必须含 `type` 字段，取值为 `"factor_based"` / `"non_factor"` / `"transitional"`。

### 1.2 发射器（emit）

所有诊断类接收可选的 `emit: Callable[[str, dict], None] | None` 参数，用于向调用方发送 NDJSON 事件：

- `emit("log", {"level": "info"|"warn", "message": str})` — 进度/警告
- `emit("error", {"error": {"code": str, "message": str}})` — 错误

`emit is None` 时诊断类应使用无操作函数兜底。

### 1.3 synthetic 诊断

- synthetic（合成/模拟）诊断默认关闭。
- 仅开发模式可启用：通过参数 `params["synthetic"] = True` 开启。
- 启用后，诊断响应必须包含 `"synthetic": true` 顶层字段。
- 生产环境忽略 `synthetic` 参数。

### 1.4 数据不足行为

当输入数据不足以产生有效诊断结果时（如 K 线少于 30 根），诊断算法必须：

1. 通过 `emit("log", {"level": "warn", "message": ...})` 发出警告
2. 返回空结构（字段名与正常结果一致，值设为空数组/零值）
3. 不抛出异常

---

## 2. 数据输入来源

### 2.1 Price bars（三类通用）

- **来源**: `DataClient.query_bars_df()` / `_bars_df` 测试参数
- **所需字段**: `timestamp`, `open`, `high`, `low`, `close`, `volume`
- **最小数量**: 30 根（不足时返回空结果）
- **加载参数**:
  - `symbol: str` — 标的代码
  - `timeframe: str` — 时间周期（`"1d"`, `"1h"`, `"30m"` 等）
  - `dataRange: dict` — 时间范围（`{startTs, endTs, dbPath}`）

### 2.2 Factor values（factor_based 专用）

- **来源**: `FormulaFactor.compute()` 对 price bars 计算得出
- **因子公式来源**: `configSnapshot.params.factorPool` 中的因子 ID 列表 → `_DEFAULT_FACTOR_FORMULAS` 映射
- **默认因子兜底**: `factorPool` 为空时使用 `["mom", "vol", "turn"]` 三个默认因子
- **最小有效因子数**: 1 个（无有效因子时返回空结果）

### 2.3 Event-sentiment records（transitional 专用）

- **来源**: 暂未实现（transitional 当前为 stub）
- **预期来源**: `DataClient.query_event_sentiment()` 或类似接口
- **所需字段**: `timestamp`, `sentiment_score`, `event_type`, `source`
- **预期最小数量**: 待定（Phase 6 实现时确定）

---

## 3. 错误码

| 错误码                    | 触发条件                                                                            | 适用分类                               |
| ------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| `NO_PRICE_DATA`           | DataClient 查询返回 None / 空 DataFrame / 加载异常                                  | factor_based, non_factor, transitional |
| `NO_FACTOR_DATA`          | 所有因子公式计算均失败 / 无有效因子值 / `_build_factor_defs` 返回空且默认因子也无效 | factor_based                           |
| `NO_EVENT_SENTIMENT_DATA` | event-sentiment 查询返回空 / 数据不足（Phase 6 实现）                               | transitional                           |
| `INVALID_CONFIG_SNAPSHOT` | `configSnapshot` 缺失 / `params` 为非 dict / 策略名称为空                           | factor_based, non_factor, transitional |
| `DIAGNOSTICS_ERROR`       | 诊断执行过程中发生未预期的异常（catch-all）                                         | 全部                                   |

触发条件说明：

- `NO_PRICE_DATA`: `DataClient.query_bars_df()` 抛出异常或返回的 DataFrame 为 `None`／长度为零。
- `NO_FACTOR_DATA`: 所有因子公式在 `FormulaFactor.compute()` 阶段均返回有效值不足 10 行的序列；或 `_build_factor_defs()` 返回空且默认因子全部计算失败。
- `NO_EVENT_SENTIMENT_DATA`（预留）: 事件情感数据查询返回空或有效记录不足。
- `INVALID_CONFIG_SNAPSHOT`: `params["configSnapshot"]` 不存在或非 dict；或 `configSnapshot["strategy"]` 为空字符串。
- `DIAGNOSTICS_ERROR`: 上述错误码未覆盖的运行时异常（如 import 错误、类型错误等），作为最后一道防线。

---

## 4. FactorDiagnosticsResult（factor_based）

### 4.1 输入参数

```python
params = {
    "symbol": str,                  # 标的代码
    "timeframe": str,               # 时间周期，默认 "1d"
    "dataRange": dict,              # 时间范围 {startTs, endTs, dbPath}
    "configSnapshot": {             # 配置快照
        "strategy": str,
        "params": {
            "factorPool": list[str],  # 因子 ID 列表，如 ["mom", "vol", "turn"]
            ...
        }
    },
    "synthetic": bool | None,       # 是否启用 synthetic 模式（仅开发环境生效）
    "_bars_df": pd.DataFrame | None # 测试用预加载数据，非 None 时跳过 DataClient
}
```

### 4.2 最小算法规则

1. 通过 `FormulaFactor` 对 price bars 计算每个因子的数值序列。
2. 按月分组，对每个因子计算与 T+1 forward return 的 Pearson IC 和 Spearman Rank IC。
3. 按首因子值的分位数（`pd.qcut`）将标的分为 Q1（最低）~ Q5（最高）五组，按月累积各组等权平均收益。
4. 对多因子的周期均值（按月均值化后的因子值）计算 Pearson 相关矩阵。
5. 汇总统计：`mean_ic`（IC 序列均值）、`ic_std`（IC 序列标准差）、`ic_ir`（`mean_ic / ic_std`，信息比率）、`mean_rank_ic`（Rank IC 序列均值）。
6. 数据不足：K 线 < 30 根、月份 < 2 个月、对齐后数据 < 10 行、单周期样本 < 5 时，返回空结果。

### 4.3 输出结构

```python
{
    "type": "factor_based",
    "ic_series": [                           # IC 序列，按时间排序
        {
            "period": str,                   # 月份标签，如 "2026-01"
            "ic": float,                     # 该月均值 Pearson IC，保留 4 位小数
            "rank_ic": float                 # 该月均值 Spearman Rank IC，保留 4 位小数
        },
        ...
    ],
    "layered_returns": {                     # 分层收益累积曲线
        "Q1": [float, ...],                  # 最低组，从 1.0 开始的累积收益，保留 6 位小数
        "Q2": [float, ...],
        "Q3": [float, ...],
        "Q4": [float, ...],
        "Q5": [float, ...]                   # 最高组
    },
    "correlation_matrix": [                  # N×N 因子周期均值 Pearson 相关矩阵
        [float, float, ...],
        ...
    ],
    "factor_labels": [str, ...],             # 因子名称列表，与 correlation_matrix 行列对应
    "summary": {
        "mean_ic": float,                    # IC 序列均值，保留 4 位小数
        "ic_std": float,                     # IC 序列标准差（ddof=1），保留 4 位小数
        "ic_ir": float,                      # 信息比率 = mean_ic / ic_std
        "mean_rank_ic": float                # Rank IC 序列均值，保留 4 位小数
    }
}
```

### 4.4 空结果

```python
{
    "type": "factor_based",
    "ic_series": [],
    "layered_returns": {
        "Q1": [], "Q2": [], "Q3": [], "Q4": [], "Q5": []
    },
    "correlation_matrix": [],
    "factor_labels": [],
    "summary": {
        "mean_ic": 0.0,
        "ic_std": 0.0,
        "ic_ir": 0.0,
        "mean_rank_ic": 0.0
    }
}
```

### 4.5 单因子特殊情况

当只有一个因子时：

- `correlation_matrix`: `[[1.0]]`
- `factor_labels`: `[factor_label]`
- 其余字段与多因子一致

---

## 5. NonFactorDiagnosticsResult（non_factor）

### 5.1 输入参数

```python
params = {
    "symbol": str,                  # 标的代码
    "timeframe": str,               # 时间周期，默认 "1d"
    "dataRange": dict,              # 时间范围 {startTs, endTs, dbPath}
    "configSnapshot": {             # 配置快照
        "strategy": str,
        "params": {
            # 数值型参数 + 可选 uiConstraints
            "period": {"value": 10, "uiConstraints": {"min": 3, "max": 60}},
            "threshold": {"value": 0.02, "uiConstraints": {"min": 0.001, "max": 0.1}},
            # 或顶层 uiConstraints 键
            "uiConstraints": {
                "period": {"min": 3, "max": 60},
                ...
            },
            ...
        }
    },
    "synthetic": bool | None,
    "_bars_df": pd.DataFrame | None
}
```

### 5.2 最小算法规则

1. **参数敏感性**：从 `configSnapshot.params` 提取数值型参数。对有 `[min, max]` 约束的参数，在区间内均匀取 5 个值，各跑基于 MA 交叉信号的简化回测，记录收益率和夏普比率。无 `min/max` 约束的参数跳过。
2. **信号质量**：基于基准 MA 周期生成金叉/死叉交易信号，统计总交易数、胜率、平均持仓 bar 数、盈亏比、最大连续亏损次数。当 MA 信号无交易时，fallback 到短/长期均线比较产生的方向信号。
3. **滑点压力**：分别在 1bps / 3bps / 5bps / 10bps 滑点水平下重算收益、夏普和交易数量。交易数量保持不变（同一信号源），每笔收益扣除对应滑点成本。
4. 数据不足：K 线 < 30 根、缺少 `close` 列时，返回空结果。

### 5.3 输出结构

```python
{
    "type": "non_factor",
    "param_sensitivity": [                    # 参数敏感性分析
        {
            "param": str,                    # 参数名称
            "values": [float, ...],          # 5 个均匀取值，保留 4 位小数
            "returns": [float, ...],         # 各取值对应的累计收益率，保留 6 位小数
            "sharpe": [float, ...]           # 各取值对应的夏普比率（年化），保留 4 位小数
        },
        ...
    ],
    "signal_quality": {                      # 信号质量统计
        "total_signals": int,                # 总交易笔数
        "win_rate": float,                   # 胜率，保留 4 位小数
        "avg_holding_bars": float,           # 平均持仓 bar 数，保留 2 位小数
        "profit_factor": float,              # 盈亏比（总盈利/总亏损），保留 4 位小数
        "max_consecutive_losses": int        # 最大连续亏损次数
    },
    "slippage_stress": [                     # 滑点压力测试
        {
            "bps": int,                      # 滑点基点，取值 1/3/5/10
            "return": float,                 # 该滑点下的累计收益率，保留 6 位小数
            "sharpe": float,                 # 该滑点下的夏普比率，保留 4 位小数
            "trade_count": int               # 该滑点下的交易笔数
        },
        ...
    ]
}
```

### 5.4 空结果

```python
{
    "type": "non_factor",
    "param_sensitivity": [],
    "signal_quality": {
        "total_signals": 0,
        "win_rate": 0.0,
        "avg_holding_bars": 0.0,
        "profit_factor": 0.0,
        "max_consecutive_losses": 0
    },
    "slippage_stress": [
        {"bps": 1, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
        {"bps": 3, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
        {"bps": 5, "return": 0.0, "sharpe": 0.0, "trade_count": 0},
        {"bps": 10, "return": 0.0, "sharpe": 0.0, "trade_count": 0}
    ]
}
```

### 5.5 无约束参数情况

当所有数值参数都缺少 `min/max` 约束时：

- `param_sensitivity` 返回空数组（不崩溃）
- `signal_quality` 使用默认周期 10 计算
- `slippage_stress` 正常计算

---

## 6. TransitionalDiagnosticsResult（transitional）

### 6.1 输入参数

```python
params = {
    "symbol": str,                  # 标的代码
    "timeframe": str,               # 时间周期，默认 "1d"
    "dataRange": dict,              # 时间范围 {startTs, endTs, dbPath}
    "configSnapshot": {             # 配置快照
        "strategy": str,
        "params": {
            "dataSource": str,         # 事件/情感数据源
            "decayHalfLife": int,      # 衰减半衰期（天）
            "targetFactor": str,       # 映射目标因子 ID
            ...
        }
    },
    "synthetic": bool | None,
    "_bars_df": pd.DataFrame | None
}
```

### 6.2 最小算法规则（Phase 6 实现，当前为 stub）

> **⚠️ 当前过渡形态诊断返回 stub 空结果（字段结构同 factor_based 空结果）。以下规则为 Phase 6 目标行为，暂未实现。**

1. **情感衰减曲线**：对 event-sentiment records，按 `decayHalfLife` 计算指数衰减加权的情感得分序列。
2. **映射目标指标**：将衰减后的情感得分映射为目标因子值（通过 `targetFactor` 指定的映射函数），计算映射后的因子与原始目标因子的相关性。
3. **标准化因子质量**：对映射后的因子计算均值、标准差、偏度、峰度、Sharpe 比率等标准化质量指标。
4. **映射验证**：对映射结果进行回测验证，比较映射因子与原始因子的分层收益差异。
5. 数据不足：event-sentiment records 为空或不足时返回空结果。

### 6.3 输出结构（目标结构，Phase 6 实现后使用）

```python
{
    "type": "transitional",
    # ── 情感衰减曲线（Sentiment Decay Curve）──
    "decay_curve": {                         # 指数衰减情感得分
        "dates": [str, ...],                 # 日期标签
        "raw_sentiment": [float, ...],       # 原始情感得分序列
        "decayed_sentiment": [float, ...],   # 衰减后情感得分序列
        "half_life": int                     # 使用的半衰期（天）
    },
    # ── 映射目标指标（Mapping Target Indicators）──
    "mapping_metrics": {
        "target_factor_id": str,             # 目标因子 ID
        "correlation_with_target": float,    # 衰减情感与目标因子的 Pearson 相关系数
        "spearman_with_target": float,       # Spearman 相关系数
        "mapping_rmse": float                # 映射均方根误差
    },
    # ── 标准化因子质量（Standardized Factor Quality）──
    "factor_quality": {
        "mean": float,                       # 映射因子均值
        "std": float,                        # 映射因子标准差
        "skewness": float,                   # 偏度
        "kurtosis": float,                   # 峰度
        "sharpe": float                      # 映射因子的夏普比率
    },
    # ── 映射验证（Mapping Validation）──
    "mapping_validation": {
        "mapped_layered_returns": {          # 映射因子的分层收益
            "Q1": [float, ...],
            "Q2": [float, ...],
            "Q3": [float, ...],
            "Q4": [float, ...],
            "Q5": [float, ...]
        },
        "target_layered_returns": {          # 目标因子的分层收益（对比基准）
            "Q1": [float, ...],
            "Q2": [float, ...],
            "Q3": [float, ...],
            "Q4": [float, ...],
            "Q5": [float, ...]
        },
        "spread_correlation": float          # 映射与目标因子分层收益 spread 的相关性
    }
}
```

### 6.4 当前 stub 输出（Phase 6 前）

```python
{
    "type": "transitional",
    "ic_series": [],
    "layered_returns": {
        "Q1": [], "Q2": [], "Q3": [], "Q4": [], "Q5": []
    },
    "correlation_matrix": [],
    "factor_labels": [],
    "summary": {
        "mean_ic": 0.0,
        "ic_std": 0.0,
        "ic_ir": 0.0,
        "mean_rank_ic": 0.0
    }
}
```

---

## 7. 前端消费契约

### 7.1 前端解析规则

前端 `renderDiagnosticContent()` 通过 `data.type` 字段判断渲染方式：

| `data.type`    | 渲染路径                              | 核心内容                                                                                                 |
| -------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `factor_based` | `parseFactorDiagnostics()`            | ic_series → BarChart, layered_returns → HBarChart, correlation_matrix → HeatmapChart, summary → MiniGrid |
| `non_factor`   | `parseNonFactorDiagnostics()`         | param_sensitivity.sharpe → HeatmapChart, signal_quality → MiniGrid, slippage_stress.return → LineChart   |
| `transitional` | 与 factor_based 复用路径（当前 stub） | ic_series → BarChart, layered_returns → HBarChart                                                        |

### 7.2 synthetic 标记

当诊断结果来自 synthetic 模式时，结果中包含 `"synthetic": true` 顶层字段。前端应展示 synthetic 标记（如角标或提示条），但不改变渲染逻辑。

---

## 8. 实现状态

| 分类         | 状态                  | 实现位置                                          |
| ------------ | --------------------- | ------------------------------------------------- |
| factor_based | ✅ 已实现（story-19） | `diagnostics/factor.py`                           |
| non_factor   | ✅ 已实现（story-20） | `diagnostics/non_factor.py`                       |
| transitional | ⏳ stub（story-18）   | `diagnostics/transitional.py`，真实算法待 Phase 6 |
