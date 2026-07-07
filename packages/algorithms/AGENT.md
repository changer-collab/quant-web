# packages/algorithms/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 算法层只做算法实现、信号生成器、预定义模板、算法注册表。
- 不做特征工程（ai-engine 负责）、策略实现（strategies 负责）、回测撮合（backtest-engine 负责）、模型训练编排（ai-engine 负责）、HTTP/CLI 入口（strategy-runtime 负责）。
- 不引入 HTTP 入口或 CLI 入口；algorithms 通过 strategy-runtime CLI 的 `aiTrain` 命令延迟导入被调用。
- LightGBM 和 GNN 算法采用延迟导入策略，避免 algorithms 包强制加载所有 ML 库。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
算法资产层完整实现：Algorithm ABC + 5 个算法（3 sklearn 迁移 + LightGBM + GNN 骨架）+ 3 个信号生成器 + 5 个预定义模板（4 单算法 + 1 组合）
```

## 已有能力

```text
- Algorithm ABC（algorithms/base.py）：train/predict/save/load 抽象接口
- AlgorithmRegistry：算法注册表，支持 register/get/list_all
- 算法实现（algorithms/）：
  - RandomForestAlgorithm（random_forest）— 从 ai-engine 迁移，CROSS_SECTIONAL + TIME_SERIES
  - GradientBoostingAlgorithm（gradient_boosting）— 从 ai-engine 迁移，CROSS_SECTIONAL + TIME_SERIES
  - LogisticRegressionAlgorithm（logistic_regression）— 从 ai-engine 迁移，CROSS_SECTIONAL + TIME_SERIES
  - LightGBMAlgorithm（lightgbm）— 延迟导入 lightgbm，CROSS_SECTIONAL + TIME_SERIES
  - GNNAlgorithm（gnn）— PCA 占位骨架，GRAPH_EMBEDDING（真实 GNN 后续实现）
- SignalGenerator ABC（signal_generators/base.py）：generate 抽象接口
- SignalGeneratorRegistry：信号生成器注册表
- 信号生成器实现（signal_generators/）：
  - CrossSectionalRankGenerator（cross_sectional_rank）— 多标的打分→top_k 选股信号
  - TimeSeriesClassifyGenerator（time_series_classify）— 单标的概率→买卖信号
  - GraphEmbeddingGenerator（graph_embedding）— GNN embedding→因子值
- 预定义模板（templates/）：
  - AlgorithmTemplate dataclass + ComboAlgorithmTemplate ABC
  - TemplateRegistry：模板注册表
  - 4 个单算法模板：lightgbm_stock_selection / lightgbm_timing / random_forest_stock_selection / random_forest_timing
  - 1 个组合模板：gnn_lightgbm_combo（GNN→embedding→LightGBM→选股）
- 核心类型（types.py）：ApplicationMode, AlgorithmMeta, HyperParamDef, TrainConfig, ModelMetrics, LabelType, ModelArtifact, MLSignal, SignalContext, SignalGeneratorMeta
```

## 边界

只负责：

```text
算法抽象接口（Algorithm ABC）
算法实现（sklearn/LightGBM/GNN）
算法注册表（AlgorithmRegistry）
信号生成器抽象接口（SignalGenerator ABC）
信号生成器实现（截面排序/时序分类/图嵌入）
信号生成器注册表（SignalGeneratorRegistry）
预定义模板（单算法模板 + 组合模板）
模板注册表（TemplateRegistry）
核心类型契约（ApplicationMode/ModelArtifact/MLSignal 等）
```

不负责：

```text
特征工程（ai-engine FeatureExtractor 负责）
训练编排（ai-engine TrainingOrchestrator 负责）
策略实现（strategies 负责）
回测撮合（backtest-engine 负责）
数据读取（data-client 负责）
HTTP API（api 负责）
任务编排（worker 负责）
CLI 入口（strategy-runtime 负责）
```

## 拥有的类型

按 AGENTS.md 类型归属原则，algorithms 拥有（定义在 `types.py`）：

```text
ApplicationMode, Algorithm, AlgorithmMeta, HyperParamDef, ModelArtifact,
SignalGenerator, SignalGeneratorMeta, MLSignal, SignalContext,
AlgorithmRegistry, SignalGeneratorRegistry,
AlgorithmTemplate, ComboAlgorithmTemplate, ComboContext, TemplateRegistry,
TrainConfig（从 ai-engine 迁移）, ModelMetrics（从 ai-engine 迁移）, LabelType（从 ai-engine 迁移）
```

其他模块通过合法依赖链获取这些类型，不重复定义。

## 依赖

```text
quantforge-strategy（strategy-runtime）— StrategyCategory、StrategySubcategory 类型
numpy, pandas, scikit-learn, joblib
lightgbm（可选，延迟导入）
```

## 被依赖方向

```text
packages/ai-engine -> packages/algorithms
packages/strategies -> packages/algorithms
packages/factor-lab -> packages/algorithms（后续 AlgorithmFactor 扩展时引入）
packages/strategy-runtime CLI（commands/ai_train.py 延迟导入）
```

依赖链：

```text
algorithms -> strategy-runtime（纯标准化库）
```

## 调用方式

algorithms 无 CLI 入口，通过 strategy-runtime CLI 间接调用：

```bash
echo '{"command":"aiTrain","templateId":"lightgbm_stock_selection",...}' | python -m quantforge_strategy.cli
```

## 运行约束

- LightGBM 算法延迟导入：仅在 `LightGBMAlgorithm._import_lgbm()` 时 import lightgbm，注册时不强制安装
- GNN 算法当前为 PCA 占位骨架，真实 torch-geometric 实现作为后续工作
- MLSignal 命名避免与 strategy-runtime 的 Signal 枚举冲突
