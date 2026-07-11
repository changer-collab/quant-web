# QuantForge 算法资产层（quantforge-algorithms）

## 定位

算法资产层——Algorithm ABC + SignalGenerator + 预定义模板，让算法成为独立的一等公民包。

## 核心抽象

- **Algorithm ABC**：train → ModelArtifact，predict，应用无关
- **SignalGenerator ABC**：artifact 输出 → MLSignal，决定应用形态
- **AlgorithmTemplate**：预定义组合模板，支持 artifact 传递

## 算法清单

| 算法 | 注册名 | 支持模式 |
|---|---|---|
| RandomForest | random_forest | CROSS_SECTIONAL, TIME_SERIES |
| GradientBoosting | gradient_boosting | CROSS_SECTIONAL, TIME_SERIES |
| LogisticRegression | logistic_regression | CROSS_SECTIONAL, TIME_SERIES |
| LightGBM | lightgbm | CROSS_SECTIONAL, TIME_SERIES |
| GNN（骨架） | gnn | GRAPH_EMBEDDING |

## 信号生成器清单

| 生成器 | 注册名 | 应用模式 |
|---|---|---|
| CrossSectionalRank | cross_sectional_rank | CROSS_SECTIONAL |
| TimeSeriesClassify | time_series_classify | TIME_SERIES |
| GraphEmbedding | graph_embedding | GRAPH_EMBEDDING |

## 预定义模板清单

| 模板 ID | 类型 | 算法 | 信号生成器 |
|---|---|---|---|
| lightgbm_stock_selection | 单算法 | lightgbm | cross_sectional_rank |
| lightgbm_timing | 单算法 | lightgbm | time_series_classify |
| random_forest_stock_selection | 单算法 | random_forest | cross_sectional_rank |
| random_forest_timing | 单算法 | random_forest | time_series_classify |
| gnn_lightgbm_combo | 组合 | GNN→LightGBM | cross_sectional_rank |

## 安装

```bash
pip install -e packages/algorithms
# 可选：LightGBM 支持
pip install -e packages/algorithms[lightgbm]
```

## 测试

```bash
cd packages/algorithms
python -m pytest tests/ -v
```
