# 算法层架构设计：packages/algorithms 算法资产层

> **状态：产品目标 spec** | **日期：2026-07-07** | **范围：packages/algorithms 新建 + ai-engine 瘦身 + strategies 迁移**
>
> **前置背景**：[2026-06-28 策略分类体系重构](./2026-06-28-strategy-classification-and-config-design.md) 已建立 StrategyCategory 三类十值，但只描述"策略怎么用"，未抽象"算法本身"。本 spec 补齐算法层抽象。
>
> **后续计划入口**：spec 用户审查通过后，调用 writing-plans skill 生成实施计划。

---

## 一、问题陈述

当前机器学习相关代码存在四个结构性缺陷：

### 1.1 算法与应用耦合

`ai-engine/model.py` 的 `ModelTrainer._MODEL_MAP` 硬编码三个 sklearn 算法（RandomForest/GradientBoosting/LogisticRegression），且 `ModelTrainer` 同时承担三件事：

- 算法实现（`_MODEL_MAP` 映射）
- 训练编排（`train()` 调用 fit）
- 应用形态（隐含分类输出 binary）

同一算法无法支持多种应用场景。例如 LightGBM 既可用于截面排序（择股，因子型），也可用于个股时序预测（择时，非因子型），但当前架构无法表达这种"算法 ≠ 应用"的区分。

### 1.2 信号生成逻辑缺失

`AIPredictor.predict()` 直接输出 `predict_proba` 结果，策略 `AIPredictorStrategy` 内部硬编码消费这个概率。没有独立的"信号生成器"抽象——把模型输出（打分/概率/embedding）转换为策略可消费的统一信号（买/卖/持有 + 打分/概率）。

### 1.3 算法组合无机制

用户诉求：GNN 做行业关联分析 → 生成非线性因子 → LightGBM 排序选股。当前架构是单算法单输入单输出，无 artifact 传递机制，无法组合多个算法。

### 1.4 算法非一等公民

当前包结构（AGENTS.md 白名单）中，算法散落在 `ai-engine`，没有独立的算法注册表、算法元数据、算法发现机制。算法无法被 `factor-lab`（非线性因子）、`strategies`（AI 策略）等下游模块以统一方式复用。

---

## 二、设计目标与约束

### 2.1 设计目标

1. **算法与应用解耦**：算法层只负责"输入特征+标签 → 模型 artifact"，应用形态由信号生成器决定。
2. **算法作为一等公民**：独立 `packages/algorithms` 包，含 Algorithm ABC、注册表、元数据、信号生成器、预定义模板。
3. **同算法多应用场景**：LightGBM 等算法可同时支持择股（截面排序）和择时（时序分类）。
4. **预定义模板支持算法组合**：GNN→LightGBM 等组合通过预定义模板实现，模板内部是固定流水线，artifact 在步骤间传递。
5. **迁移路径清晰**：ai-engine 瘦身但不推倒重来，strategies 的 AI 策略改为引用 artifact_id。

### 2.2 设计约束

- **预定义模板起步，DAG 编排为后续计划**：当前只在代码内定义组合模板，前端选模板+填参数。运行时拖拽组合（n8n 风格）写入后续计划，不在本 spec 范围。
- **不引入 HTTP/CLI 入口**：algorithms 包通过 strategy-runtime CLI 的 `aiTrain`/`backtest` 命令延迟导入被调用，符合现有包边界约定。
- **不实现模型注册表 DB 表**：本 spec 只定义 ModelArtifact 类型契约，DB 持久化（`model_artifacts` 表）在"训练流程产品化"后续 spec 实现。
- **不实现 AITrainHandler**：Worker 的训练任务处理器在后续 spec 实现。
- **不做前端算法配置页**：依赖训练流程产品化，不在本 spec 范围。

---

## 三、整体分层与包边界

### 3.1 分层架构

```
算法资产层    packages/algorithms
              ├─ algorithms/        Algorithm ABC + 实现 + AlgorithmRegistry
              ├─ signal_generators/ SignalGenerator ABC + 实现
              ├─ templates/         预定义组合模板 + TemplateRegistry
              └─ types.py           核心类型契约
                       ↓ ModelArtifact + Signal
训练编排层    packages/ai-engine
              ├─ features.py        FeatureExtractor（保留，后续扩展）
              ├─ trainer.py         TrainingOrchestrator（原 ModelTrainer 退化，调用 Algorithm.train）
              ├─ report_analysis/   保留不变
              └─ predictor.py       废弃（拆解到 algorithms + signal_generators）
                       ↓
策略消费层    packages/strategies
              └─ ai_predictor.py    重构为引用 model_artifact_id + SignalGenerator
```

### 3.2 包依赖关系（AGENTS.md 白名单更新）

新增白名单条目：

```
packages/algorithms -> strategy-runtime（引用 StrategyCategory / StrategySubcategory 枚举）
packages/ai-engine -> packages/algorithms
packages/strategies -> packages/algorithms
packages/factor-lab -> packages/algorithms（后续非线性因子扩展时引入）
```

`packages/algorithms` 仅依赖 strategy-runtime（纯标准库）+ 第三方 ML 库（lightgbm/torch 等，延迟导入），是依赖链叶子节点。

### 3.3 角色定义（AGENTS.md 新增）

**算法层 Agent**：
- 负责 `packages/algorithms`。
- 只做算法实现、信号生成器、预定义模板、算法注册表。
- 不做特征工程（ai-engine 负责）、策略实现（strategies 负责）、回测撮合（backtest-engine 负责）、模型训练编排（ai-engine 负责）、HTTP/CLI 入口（strategy-runtime 负责）。

---

## 四、核心类型契约

### 4.1 应用模式枚举

```python
# packages/algorithms/types.py

class ApplicationMode(str, Enum):
    """算法的应用模式——决定输入数据形态和信号生成器选择"""
    CROSS_SECTIONAL = "cross_sectional"    # 截面排序（多标的同一时点打分）
    TIME_SERIES = "time_series"            # 时序分类（单标的按时点预测）
    GRAPH_EMBEDDING = "graph_embedding"    # 图嵌入（GNN 输出 embedding 作为下游特征）
```

### 4.2 Algorithm ABC

```python
class Algorithm(ABC):
    """算法资产层抽象基类。

    算法层只负责：训练（fit）+ 预测（predict）+ 持久化（save/load）。
    算法层不感知应用形态——同一个 LightGBM 算法可被截面排序和时序分类复用。
    """

    @property
    @abstractmethod
    def meta(self) -> AlgorithmMeta:
        """算法元数据：名称、支持的应用模式、超参数定义"""

    @abstractmethod
    def train(self, X: pd.DataFrame, y: pd.Series, config: TrainConfig) -> ModelArtifact:
        """训练模型，返回可持久化的 ModelArtifact"""

    @abstractmethod
    def predict(self, artifact: ModelArtifact, X: pd.DataFrame) -> np.ndarray:
        """使用已训练 artifact 进行预测，返回原始输出（打分/概率/embedding）"""

    @abstractmethod
    def save(self, artifact: ModelArtifact, path: Path) -> None:
        """持久化 artifact 到文件"""

    @abstractmethod
    def load(self, path: Path) -> ModelArtifact:
        """从文件加载 artifact"""
```

### 4.3 算法元数据

```python
@dataclass(frozen=True)
class AlgorithmMeta:
    name: str                                      # "lightgbm" / "gnn" / "random_forest"
    supported_modes: list[ApplicationMode]         # 算法支持的应用模式
    hyper_param_defs: list[HyperParamDef]          # 超参数定义（供前端表单生成）
    description: str
    version: str

@dataclass(frozen=True)
class HyperParamDef:
    key: str                                       # "max_depth" / "learning_rate"
    label: str                                     # "树深" / "学习率"
    type: Literal["int", "float", "select", "bool"]
    default: Any
    range: tuple[float, float] | None = None       # 数值范围
    options: list[str] | None = None               # select 选项
    description: str = ""
```

### 4.4 ModelArtifact

```python
@dataclass
class ModelArtifact:
    """训练产物——算法层与信号生成器、策略层之间的契约对象。

    artifact_id 是后续模型注册表的索引键（当前阶段只生成 UUID，不持久化到 DB）。
    application_mode 从 TrainConfig.application_mode 复制，便于消费方直接读取。
    """

    artifact_id: str                               # UUID4
    algorithm: str                                 # 算法名（对应 AlgorithmMeta.name）
    model: Any                                     # 算法特定的模型对象（LightGBM booster / GNN weights）
    config: TrainConfig                            # 训练配置快照（含 application_mode）
    metrics: ModelMetrics                          # 训练指标
    feature_schema: list[str]                      # 训练时的特征列名（预测时对齐）
    application_mode: ApplicationMode              # 训练时的应用模式（从 config 复制）
    trained_at: int                                # 训练时间戳
    artifact_path: str | None = None               # 持久化路径（save 后填）
```

### 4.4.1 TrainConfig 扩展

`TrainConfig` 从 ai-engine 迁移到 algorithms 时扩展 `application_mode` 字段：

```python
@dataclass(frozen=True)
class TrainConfig:
    algorithm: str                                 # 算法名（对应 AlgorithmMeta.name）
    application_mode: ApplicationMode               # 应用模式（决定信号生成器选择）
    test_size: float = 0.2
    random_state: int = 42
    hyper_params: dict = field(default_factory=dict)
    label_type: LabelType = LabelType.RETURN_BINARY
```

`Algorithm.train(X, y, config)` 从 `config.application_mode` 读取应用模式，训练完成后写入 `ModelArtifact.application_mode`。

### 4.5 SignalGenerator ABC

```python
class SignalGenerator(ABC):
    """信号生成器——把算法原始输出转换为策略可消费的统一信号。

    信号生成器决定应用形态：
    - CrossSectionalRankGenerator：多标的打分 → 选股信号（top_k 标的 + 权重）
    - TimeSeriesClassifyGenerator：单标的概率 → 买卖信号（threshold 触发）
    - GraphEmbeddingGenerator：GNN embedding → 非线性因子（输出因子值供下游消费）
    """

    @property
    @abstractmethod
    def meta(self) -> SignalGeneratorMeta:
        """信号生成器元数据"""

    @abstractmethod
    def generate(
        self,
        artifact: ModelArtifact,
        raw_output: np.ndarray,
        ctx: SignalContext,
    ) -> list[Signal]:
        """把算法原始输出转换为统一信号"""
```

### 4.6 信号类型

```python
@dataclass
class Signal:
    """策略层消费的统一信号。

    不同应用场景使用不同字段：
    - 截面排序：score（排序打分），symbol（标的），side=buy
    - 时序分类：probability（涨跌概率），symbol（标的），side 由 threshold 决定
    - 图嵌入：score（因子值），symbol（标的），side 不适用
    """

    timestamp: int
    symbol: str
    side: Literal["buy", "sell", "hold"]
    score: float | None = None                     # 截面打分 / 因子值
    probability: float | None = None               # 时序分类概率
    reason: str = ""                               # 信号生成原因

@dataclass
class SignalContext:
    """信号生成上下文"""
    timestamp: int                                 # 当前时点
    symbols: list[str]                             # 当前标的池
    threshold: float | None = None                 # 时序分类的买卖阈值
    top_k: int | None = None                       # 截面排序的选股数量
```

### 4.7 预定义模板

```python
@dataclass(frozen=True)
class AlgorithmTemplate:
    """预定义组合模板——固定算法+信号生成器+应用模式的组合。

    前端选模板 + 填超参，后端按模板执行。
    组合模板（如 GNN→LightGBM）内部是固定流水线，artifact 在步骤间传递。
    """

    template_id: str                               # "lightgbm_stock_selection"
    name: str                                      # "LightGBM 截面排序选股"
    application_mode: ApplicationMode              # 主应用模式
    algorithm: str                                 # 单算法模板的算法名
    signal_generator: str                          # 信号生成器名
    description: str
    hyper_param_overrides: dict                    # 模板默认超参
    category_hint: StrategyCategory                # 建议的策略分类
    subcategory_hint: StrategySubcategory
    is_combo: bool = False                         # 是否组合模板（多算法流水线）

class ComboAlgorithmTemplate(ABC):
    """组合模板基类——多算法流水线，artifact 在步骤间传递。

    单算法模板用 AlgorithmTemplate dataclass 描述即可；
    组合模板需要实现 run() 方法，内部编排多个算法。
    """

    @property
    @abstractmethod
    def template_id(self) -> str: ...

    @property
    @abstractmethod
    def meta(self) -> AlgorithmTemplate: ...

    @abstractmethod
    def run(self, ctx: ComboContext) -> list[Signal]:
        """执行组合流水线，返回最终信号"""
```

---

## 五、算法实现清单

### 5.1 从 ai-engine 迁移的算法

`ai-engine/model.py` 的 `_MODEL_MAP` 三个算法迁移到 `packages/algorithms/algorithms/sklearn_impl.py`：

| 算法类 | 算法名 | 支持模式 | 备注 |
|---|---|---|---|
| `RandomForestAlgorithm` | `random_forest` | CROSS_SECTIONAL, TIME_SERIES | 从 ai-engine 迁移 |
| `GradientBoostingAlgorithm` | `gradient_boosting` | CROSS_SECTIONAL, TIME_SERIES | 从 ai-engine 迁移 |
| `LogisticRegressionAlgorithm` | `logistic_regression` | CROSS_SECTIONAL, TIME_SERIES | 从 ai-engine 迁移 |

### 5.2 新增算法

| 算法类 | 算法名 | 支持模式 | 备注 |
|---|---|---|---|
| `LightGBMAlgorithm` | `lightgbm` | CROSS_SECTIONAL, TIME_SERIES | 新增，需引入 lightgbm 依赖 |
| `GNNAlgorithm` | `gnn` | GRAPH_EMBEDDING | 新增，需引入 torch/torch-geometric 依赖 |

**依赖说明**：lightgbm 和 torch/torch-geometric 是较重的依赖，采用延迟导入策略——仅在对应算法被实例化时才 import，避免 algorithms 包导入时强制加载所有 ML 库。

### 5.3 算法注册表

```python
# packages/algorithms/algorithms/registry.py

class AlgorithmRegistry:
    _registry: dict[str, type[Algorithm]] = {}

    @classmethod
    def register(cls, algorithm_cls: type[Algorithm]) -> None:
        instance = algorithm_cls()
        cls._registry[instance.meta.name] = algorithm_cls

    @classmethod
    def get(cls, name: str) -> Algorithm:
        if name not in cls._registry:
            raise KeyError(f"Algorithm '{name}' not registered")
        return cls._registry[name]()

    @classmethod
    def list_all(cls) -> list[AlgorithmMeta]:
        return [cls().meta for cls in cls._registry.values()]

# __init__.py 自动注册
AlgorithmRegistry.register(RandomForestAlgorithm)
AlgorithmRegistry.register(GradientBoostingAlgorithm)
AlgorithmRegistry.register(LogisticRegressionAlgorithm)
AlgorithmRegistry.register(LightGBMAlgorithm)
AlgorithmRegistry.register(GNNAlgorithm)
```

---

## 六、信号生成器实现

### 6.1 信号生成器清单

| 生成器类 | 生成器名 | 应用模式 | 输入 → 输出 |
|---|---|---|---|
| `CrossSectionalRankGenerator` | `cross_sectional_rank` | CROSS_SECTIONAL | 多标的打分数组 → top_k 选股 Signal |
| `TimeSeriesClassifyGenerator` | `time_series_classify` | TIME_SERIES | 单标的概率数组 → 买卖 Signal |
| `GraphEmbeddingGenerator` | `graph_embedding` | GRAPH_EMBEDDING | GNN embedding → 因子值 Signal |

### 6.2 信号生成器注册表

```python
# packages/algorithms/signal_generators/registry.py

class SignalGeneratorRegistry:
    _registry: dict[str, type[SignalGenerator]] = {}

    @classmethod
    def register(cls, generator_cls: type[SignalGenerator]) -> None:
        instance = generator_cls()
        cls._registry[instance.meta.name] = generator_cls

    @classmethod
    def get(cls, name: str) -> SignalGenerator: ...

    @classmethod
    def list_all(cls) -> list[SignalGeneratorMeta]: ...
```

---

## 七、预定义模板机制

### 7.1 单算法模板清单

| 模板 ID | 名称 | 算法 | 信号生成器 | 应用模式 | 策略分类建议 |
|---|---|---|---|---|---|
| `lightgbm_stock_selection` | LightGBM 截面排序选股 | lightgbm | cross_sectional_rank | CROSS_SECTIONAL | factor_based / ml_nonlinear_factor |
| `lightgbm_timing` | LightGBM 个股择时 | lightgbm | time_series_classify | TIME_SERIES | non_factor / e2e_ai_timeseries |
| `random_forest_stock_selection` | 随机森林截面选股 | random_forest | cross_sectional_rank | CROSS_SECTIONAL | factor_based / ml_nonlinear_factor |
| `random_forest_timing` | 随机森林个股择时 | random_forest | time_series_classify | TIME_SERIES | non_factor / e2e_ai_timeseries |

### 7.2 组合模板清单

| 模板 ID | 名称 | 流水线 | 应用模式 | 策略分类建议 |
|---|---|---|---|---|
| `gnn_lightgbm_combo` | GNN+LightGBM 组合选股 | GNN 训练→embedding 作为 LightGBM 特征→LightGBM 排序选股 | CROSS_SECTIONAL | factor_based / ml_nonlinear_factor |

### 7.3 组合模板的 artifact 传递

```python
# packages/algorithms/templates/gnn_lightgbm_combo.py

@dataclass
class ComboContext:
    """组合模板的执行上下文"""
    base_features: pd.DataFrame           # 基础表格特征
    graph_data: Any                        # GNN 输入图结构
    graph_labels: pd.Series               # GNN 训练标签
    rank_labels: pd.Series                # LightGBM 排序标签
    gnn_config: TrainConfig               # GNN 超参
    lgbm_config: TrainConfig              # LightGBM 超参
    signal_ctx: SignalContext             # 信号生成上下文

class GNNLightGBMComboTemplate(ComboAlgorithmTemplate):
    """GNN→LightGBM 组合选股模板。

    流水线：
    1. GNN 训练 → graph embedding artifact
    2. embedding 作为 LightGBM 的增强特征
    3. LightGBM 训练 → ranking artifact
    4. CrossSectionalRankGenerator 生成选股信号
    """

    @property
    def template_id(self) -> str:
        return "gnn_lightgbm_combo"

    def run(self, ctx: ComboContext) -> list[Signal]:
        # Step 1: GNN 训练
        gnn = AlgorithmRegistry.get("gnn")
        gnn_artifact = gnn.train(ctx.graph_data, ctx.graph_labels, ctx.gnn_config)

        # Step 2: embedding 增强基础特征
        graph_embedding = gnn.predict(gnn_artifact, ctx.graph_data)
        enhanced_features = ctx.base_features.merge(
            pd.DataFrame(graph_embedding, index=ctx.base_features.index),
            left_index=True, right_index=True,
        )

        # Step 3: LightGBM 训练
        lgbm = AlgorithmRegistry.get("lightgbm")
        lgbm_artifact = lgbm.train(enhanced_features, ctx.rank_labels, ctx.lgbm_config)

        # Step 4: 信号生成
        raw_output = lgbm.predict(lgbm_artifact, enhanced_features)
        generator = SignalGeneratorRegistry.get("cross_sectional_rank")
        return generator.generate(lgbm_artifact, raw_output, ctx.signal_ctx)
```

### 7.4 模板注册表

```python
# packages/algorithms/templates/registry.py

class TemplateRegistry:
    _single: dict[str, AlgorithmTemplate] = {}
    _combo: dict[str, type[ComboAlgorithmTemplate]] = {}

    @classmethod
    def register_single(cls, template: AlgorithmTemplate) -> None: ...

    @classmethod
    def register_combo(cls, combo_cls: type[ComboAlgorithmTemplate]) -> None: ...

    @classmethod
    def get(cls, template_id: str) -> AlgorithmTemplate | ComboAlgorithmTemplate: ...

    @classmethod
    def list_all(cls) -> list[AlgorithmTemplate]: ...
```

---

## 八、与现有模块的迁移影响

### 8.1 packages/ai-engine

| 文件 | 变更 |
|---|---|
| `model.py` | `ModelTrainer._MODEL_MAP` 删除，三个算法迁移到 `algorithms/sklearn_impl.py`；`ModelTrainer` 重命名为 `TrainingOrchestrator`，改为调用 `Algorithm.train`；`save/load` 改为委托 `Algorithm.save/load` |
| `predictor.py` | `AIPredictor` 废弃，训练逻辑迁移到 `TrainingOrchestrator`，信号逻辑迁移到 `algorithms/signal_generators/` |
| `features.py` | 保留不变（特征工程后续扩展 spec） |
| `report_analysis/` | 保留不变 |
| `types.py` | `ModelType` 废弃（被 `AlgorithmMeta.name` 替代）；`TrainConfig`、`ModelMetrics`、`LabelType` 迁移到 `packages/algorithms/types.py`（见 §九），ai-engine 从 algorithms 导入复用，不在 ai-engine 重复定义 |

### 8.2 packages/strategies

| 文件 | 变更 |
|---|---|
| `combined/ai_predictor.py` | 重构为 `AIModelStrategy`，通过 `model_artifact_id` + `signal_generator_name` 引用已训练模型和信号生成器，不再硬编码 `AIPredictor`；策略分类调整为 `non_factor / e2e_ai_timeseries`（保持当前 subcategory） |

### 8.3 packages/factor-lab

当前不动。后续"非线性因子"扩展时，引入 `AlgorithmFactor`：

- `AlgorithmFactor(Factor)`：内部调用 `Algorithm + SignalGenerator`，把模型输出作为因子值
- 届时 `factor-lab` 新增 `algorithms` 依赖（白名单已预留）

### 8.4 packages/strategy-runtime CLI

`aiTrain` 命令的 payload 扩展，支持 `template_id` 字段：

```json
{
  "command": "aiTrain",
  "template_id": "lightgbm_stock_selection",
  "features": { ... },
  "labels": [ ... ],
  "hyper_params": { "max_depth": 6, "learning_rate": 0.05 }
}
```

CLI 内部根据 `template_id` 分派到 `TemplateRegistry.get(template_id)`，单算法模板走 `Algorithm.train + SignalGenerator.generate`，组合模板走 `ComboAlgorithmTemplate.run`。

---

## 九、类型归属（AGENTS.md 更新）

### 9.1 packages/algorithms 拥有

```
ApplicationMode, Algorithm, AlgorithmMeta, HyperParamDef, ModelArtifact,
SignalGenerator, SignalGeneratorMeta, Signal, SignalContext,
AlgorithmRegistry, SignalGeneratorRegistry,
AlgorithmTemplate, ComboAlgorithmTemplate, ComboContext, TemplateRegistry,
TrainConfig（从 ai-engine 迁移）, ModelMetrics（从 ai-engine 迁移）, LabelType（从 ai-engine 迁移）
```

### 9.2 packages/ai-engine 调整后拥有

```
FeatureExtractor, FeatureSet（后续扩展）,
TrainingOrchestrator（原 ModelTrainer）,
report_analysis 子模块类型（LLMConfig, LLMClient, LLMClientError, ReportAnalyzer）
```

### 9.3 packages/strategy-runtime 不变

```
OrderSide, OrderType, OrderStatus, Order, Trade, Position, Account,
StrategyParamDef, ParamType, TaskStatus, TaskType, QuantError,
StrategyCategory, StrategySubcategory
```

`StrategyCategory` / `StrategySubcategory` 仍由 strategy-runtime 拥有（canonical 枚举值），algorithms 的 `AlgorithmTemplate.category_hint` 引用这两个类型。

---

## 十、后续计划（暂不实现，写入 roadmap）

以下内容不在本 spec 范围，作为后续演进：

### 10.1 训练流程产品化

- **模型注册表 DB 表**：`model_artifacts` 表（artifact_id, algorithm, metrics, path, feature_schema, created_at），训练产出持久化
- **AITrainHandler**：Worker 的训练任务处理器，调用 `TrainingOrchestrator + AlgorithmTemplate`
- **训练→回测解耦**：训练任务产出 artifact_id，回测任务通过 artifact_id 引用模型
- **训练参数前端表单**：基于 `AlgorithmMeta.hyper_param_defs` 自动生成超参表单

### 10.2 DAG 编排引擎

- 替换预定义模板，支持运行时拖拽组合算法节点
- 前端节点画布（n8n/Node-RED 风格）
- 后端 DAG 调度引擎、artifact 传递机制、节点 schema 校验

### 10.3 特征工程扩展

- 当前 `FeatureExtractor` 仅 3 类基础特征
- 后续扩展技术指标特征、基本面特征、特征流水线（中性化/标准化/正交化）
- 特征工程的前端可配置性（硬编码 vs 前端交互）单独 spec 讨论

### 10.4 因子工坊非线性因子

- `AlgorithmFactor(Factor)`：把算法输出作为因子值
- `factor-lab` 引入 `algorithms` 依赖
- 因子评估复用现有 `FactorEvaluator`

### 10.5 循环引擎接入

- 循环引擎的每次迭代可调用 `AlgorithmTemplate`（如迭代优化超参）
- 通过 Worker 编排，loop-engine 不直接依赖 algorithms

---

## 十一、明确不做

- **不做**模型注册表 DB 表——训练流程产品化 spec 实现
- **不做**AITrainHandler——训练流程产品化 spec 实现
- **不做**前端算法配置页——依赖训练流程产品化
- **不做**DAG 编排引擎——后续 spec，当前预定义模板足够
- **不做**特征工程前端可配置——单独 spec 讨论
- **不做**algorithms 包的 HTTP/CLI 入口——通过 strategy-runtime CLI 间接调用
- **不做**algorithms 包直接依赖 data-client——数据由 ai-engine/training orchestrator 准备后传入
- **不删除**现有 `ai-engine/report_analysis`——保留不变
- **不修改**`backtest-engine`、`factor-lab`（当前阶段）、`data-center`、`data-collector`、`data-client`

---

## 十二、与现有系统的兼容性

- 现有 `AIPredictorStrategy` 类名重构为 `AIModelStrategy`，策略注册名保持 `ai_predictor` 不变（避免破坏前端策略列表引用和已有配置）
- 现有 `ai-engine/model.py` 的 `ModelTrainer.save/load` 文件格式变更（joblib payload 结构调整），旧模型文件不兼容——当前 ai-engine 测试模型不持久化复用，无生产数据迁移问题
- 现有 `aiTrain` CLI 命令 payload 扩展 `template_id` 字段，向后兼容（旧 payload 走默认模板 `random_forest_timing`）
- 现有 `StrategyCategory` / `StrategySubcategory` 枚举不变，`AlgorithmTemplate` 只引用不修改
- 现有 `factor-lab` 不动，后续 `AlgorithmFactor` 扩展时才引入 algorithms 依赖

---

## 十三、验证标准

本 spec 落地后，应满足以下验证：

1. **算法复用**：`LightGBMAlgorithm` 同时被 `lightgbm_stock_selection` 模板（截面）和 `lightgbm_timing` 模板（时序）复用，算法代码无重复
2. **信号生成器解耦**：`CrossSectionalRankGenerator` 和 `TimeSeriesClassifyGenerator` 都消费 `LightGBMAlgorithm` 的输出，但生成不同信号
3. **组合模板 artifact 传递**：`gnn_lightgbm_combo` 模板内 GNN artifact 的 embedding 成功传递给 LightGBM 作为增强特征
4. **策略层解耦**：`AIModelStrategy` 通过 `model_artifact_id` + `signal_generator_name` 引用，不硬编码任何算法类
5. **包边界合规**：`algorithms` 不依赖 `ai-engine`/`strategies`/`factor-lab`；`ai-engine`/`strategies` 合法依赖 `algorithms`
6. **现有测试通过**：ai-engine 迁移后，现有 6 个测试文件（适配新接口）通过；strategies 的 `AIPredictorStrategy` 测试改为 `AIModelStrategy` 测试通过
