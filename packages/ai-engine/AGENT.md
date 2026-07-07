# packages/ai-engine/AGENT.md

## 必须遵守

- 所有回复使用中文。
- AI 引擎只做特征、标签、训练、预测、评估、模型注册、报告分析文本生成，不做回测撮合、不做实盘执行。
- 特征提取可被因子挖掘流程复用，但因子评估指标（IC、分组收益、分层回测）的计算不是 AI 引擎的职责。
- 报告分析文本生成放在 `report_analysis/` 子模块，接口设计为"输入 dict，输出文本/dict"，不依赖 BacktestResult 等业务类型，避免跨包类型耦合。当前用规则引擎+模板生成，预留 LLM 接口。
- 不引入 HTTP 入口或 CLI 入口；AI 引擎通过 strategy-runtime CLI 的 `aiTrain`/`analyze` 命令延迟导入被调用。
- 更新本目录能力或进度时，同步更新本目录 `README.md`（如存在）和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
AI 引擎完整实现：特征提取 + 模型训练 + 预测 + 报告分析（LLM 优先 + 规则引擎 fallback），6 个测试文件覆盖
```

## 已有能力

```text
- FeatureExtractor（features.py）：returns / volatility / volume_features / extract_all，纯 pandas 实现，可被因子挖掘复用
- ModelTrainer（model.py）：支持 RandomForest / GradientBoosting / LogisticRegression；当前用 sklearn train_test_split 随机切分（待换时间序列切分，见 roadmap 过拟合防护）；joblib 持久化 save/load；predict / predict_proba
- AIPredictor（predictor.py）：统一入口，串联 FeatureExtractor + ModelTrainer；标签生成内联在 _make_labels（ReturnBinary / ReturnContinuous）
- report_analysis 子模块：
  - ReportAnalyzer：双模式（LLM 优先 + 规则引擎 fallback），接口"输入 dict 输出 dict"，不依赖 BacktestResult
  - LLMConfig.from_env() 读 DEEPSEEK_API_KEY / BASE_URL / MODEL
  - LLMClient（OpenAI 兼容 httpx 封装）+ LLMClientError
  - prompts.py system/user prompt 模板
  - templates.py 规则引擎纯函数（策略逻辑映射、执行结论、风险、优势、改进、局限性、红线检查）
```

## 边界

只负责：

```text
特征提取（可被因子挖掘复用）
标签生成（内联在 predictor）
模型训练（RandomForest/GradientBoosting/LogisticRegression）
模型预测
模型持久化（joblib save/load）
报告分析文本生成（report_analysis 子模块，LLM 优先 + 规则引擎 fallback）
```

不负责：

```text
回测撮合（backtest-engine 负责）
实盘执行
因子评估指标计算（IC/分组收益/分层回测委托 backtest-engine）
数据读取（data-client 负责）
HTTP API（api 负责）
任务编排（worker 负责）
CLI 入口（strategy-runtime 提供）
策略实现（strategies 负责，AI 预测策略通过延迟导入加载已训练模型）
```

## 拥有的类型

AI 引擎拥有（定义在 `types.py` 和 `report_analysis/` 子模块）：

```text
ModelType, LabelType, TrainConfig, ModelMetrics, PredictionResult
LLMConfig, LLMClient, LLMClientError, ReportAnalyzer
```

AGENTS.md 未明确列出 AI 引擎拥有的类型，以上从代码推断。

## 依赖

```text
numpy, pandas, scikit-learn, joblib, httpx
```

AGENTS.md 白名单写 `ai-engine → data-client`，当前未实际依赖（设计意图，待落地）。

## 被依赖方向

```text
packages/strategies（AI 预测策略 AIPredictorStrategy 延迟导入 quantforge_ai.AIPredictor）
packages/strategy-runtime CLI（commands/ai_train.py、commands/analyze.py 延迟导入）
apps/worker（通过 PythonBridge 间接调用，不直接 import）
```

依赖链：

```text
ai-engine（无 @quant 运行时依赖，仅第三方库）
```

## 调用方式

AI 引擎无 CLI 入口，通过 strategy-runtime CLI 间接调用：

```bash
echo '{"command":"aiTrain",...}' | python -m quantforge_strategy.cli
echo '{"command":"analyze",...}' | python -m quantforge_strategy.cli
```

## 运行约束

- LLM 响应编码：report_analysis 用 `surrogatepass` 编码再 `replace` 解码，规避 GBK/UTF-8 surrogate 乱码
- model.py 当前用随机 `train_test_split`，roadmap 待换成时间序列切分（过拟合防护）
