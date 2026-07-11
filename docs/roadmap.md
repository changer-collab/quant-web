# 项目路线图

> 📋 最新链条审计：[pipeline-audit-2026-06-28.md](./pipeline-audit-2026-06-28.md) — 15 个环节逐项评估。5 个致命缺陷已修复 4 个，仅「过拟合防护」仍空白。

## 已完成计划

> 以下计划已全部实施完成，详细信息已沉淀到代码中。

| 日期       | 计划                                                                         | 涉及模块                                                                            |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 2026-06-16 | 因子评估报告优化                                                             | factor-lab, web                                                                     |
| 2026-06-16 | Python 引擎重塑                                                              | backtest-engine, strategy-runtime, ai-engine, data-client                           |
| 2026-06-16 | 策略运行时流式输出                                                           | strategy-runtime CLI, worker/python-bridge, API SSE, web EventSource                |
| 2026-06-17 | 因子报告视觉优化（中性化表格对齐 + 相关性图谱）                              | web/factor-report                                                                   |
| 2026-06-17 | 因子报告视觉优化 V2（族群回退表格 + 中性化卡片）                             | web/factor-report                                                                   |
| 2026-06-17 | 策略分层解耦（选股/择时/仓位管理）                                           | strategy-runtime, backtest-engine, strategies                                       |
| 2026-06-18 | 回测报告完善                                                                 | web/report                                                                          |
| 2026-06-18 | 前后端对接                                                                   | web/api, worker, API SSE                                                            |
| 2026-06-22 | 后端完善（回测报告与因子评估持久化）                                         | api/report-repo, api/eval-repo, api/report-mapper                                   |
| 2026-06-22 | 策略开发就绪（策略同步/数据导入/Worker 扩展/类型匹配）                       | api/strategy-sync, data-center/import-data, worker/main, api/task-service           |
| 2026-06-23 | 回测单次闭环打通（equity_stats/CLI 衍生统计/obsidian-sync/前端字段修复）     | backtest-engine/equity_stats, strategy-runtime/cli, web/factories                   |
| 2026-06-25 | Ralph Harness 工程加固（结构化错误记录/跨迭代反馈/收敛检测）                 | scripts/ralph/ralph-core.mjs, ralph.ps1, ralph.sh                                   |
| 2026-06-27 | 回测报告 Potential Issues 关键词瓦片                                         | web/report/KeywordTileGrid                                                          |
| 2026-06-28 | 链条致命缺陷修复（市场规则接入/FormulaFactor/AI 模型持久化/存活偏差/涨跌停） | backtest-engine, factor-lab, ai-engine, strategies                                  |
| 2026-06-28 | 策略分类体系重构 + 策略配置页 + Workspace 两步工作流                         | strategy-runtime, api（config/preview/diagnostics）, web（strategy-page/workspace） |
| 2026-06-30 | 策略分类后端契约整合与结构整理（canonical 分类/ConfigSnapshot/Preview/Task payload/ResultProcessor 注册表） | api, worker, strategy-runtime, strategies, web |
| 2026-06-25 | Agent 包装层（统一 AgentExecutor 接口）                                      | worker/agents（base/python-agent/backtest-agent）                                   |
| 2026-07-07 | 数据源增强 & Parquet 导入（mootdx fallback + 东财 8 适配器 + external_records 表 + ParquetAdapter + TimeFrame 扩展） | data-collector, data-center                                                         |
| 2026-07-07 | 算法层架构（packages/algorithms 新建） | algorithms, ai-engine, strategies, strategy-runtime |

### 策略分类后端契约整合（已完成）

- canonical 分类（StrategyCategory 三类 / StrategySubcategory 十值）三层对齐
- ConfigSnapshot 作为策略配置唯一真相源，任务 payload 强制携带
- TaskResultEnvelope 顶层含 resultId/resultType，SSE result 可恢复
- ResultProcessor 注册表：BacktestResultProcessor / DiagnosticsResultProcessor，Repo 走 Fastify DI
- Preview 契约：仅接受 chart_relevant 字段，合并 saved config 后计算
- `/api/strategies` 路由所有权统一，config/preview 收敛为内部模块
- 剩余残留：前端 `useResearchWorkflow.ts` 仍有 ResearchModeId 残迹（见待实施 #3）、Worker 死队列清理

### 算法层架构（已完成）

- 新建 `packages/algorithms`，实现 Algorithm ABC + SignalGenerator + 预定义模板
- 从 ai-engine 迁移 TrainConfig/ModelMetrics/LabelType，扩展 application_mode 字段
- 实现 5 个算法（RandomForest/GradientBoosting/LogisticRegression/LightGBM/GNN 骨架）
- 实现 3 个信号生成器（截面排序/时序分类/图嵌入）
- 实现 5 个预定义模板（4 单算法 + 1 GNN+LightGBM 组合）
- ai-engine 瘦身为 TrainingOrchestrator + FeatureExtractor + 模型注册表
- strategies AI 预测策略重构为 artifact_id 驱动

### 后续计划（暂不实现）

- 训练流程产品化：前端表单基于 HyperParamDef 自动生成，TrainConfig 可视化编辑
- DAG 编排引擎：替代 ComboAlgorithmTemplate 的线性 artifact 传递，支持分支/合并
- 特征工程扩展：特征库管理 + 特征选择自动化 + 特征重要性分析
- 因子工坊非线性因子：factor-lab 依赖 algorithms 产出非线性因子，扩展 FactorDefinition
- 循环引擎接入：loop-engine 编排算法层迭代（训练→评估→再训练）

---

## 待实施计划

> 优先级依据 [pipeline-audit-2026-06-28.md](./pipeline-audit-2026-06-28.md)：4/5 致命缺陷已修复，过拟合防护是唯一剩余的致命缺陷。

### 高优先级

### 1. 过拟合防护（唯一剩余的致命缺陷）

- **目标**：实现 Walk-Forward 分析、样本外验证、Deflated Sharpe Ratio，把 `model.py` 的随机 `train_test_split` 换成时间序列切分
- **涉及**：backtest-engine, ai-engine/model.py, api/report-mapper（OOS 字段当前硬编码为 0）
- **影响**：区分"能跑回测"与"回测结果可信"的关键分水岭

### 2. 真实数据接入批量导入验证

- **目标**：AKShare 适配器已实现，批量导入与端到端闭环待最终验证；Parquet 导入已打通（`E:\quant-data\bars\*` 36434 文件可入库）
- **涉及**：data-collector, data-center, data-client, backtest-engine
- **进展**：ParquetAdapter + import-parquet 命令已完成，TimeFrame 扩展周/月/季/年线，端到端验证通过（14347+1249 条）

### 3. 策略分类重构遗留清理

- **目标**：`useResearchWorkflow.ts` 仍残留 `ResearchModeId/activeMode/traditional`（约 10 处），spec 要求删除并替换为 `StrategyCategory`
- **涉及**：web/useResearchWorkflow, web/strategy-grid
- **备注**：原整合计划 Phase 8 残留，后端契约已对齐 canonical，前端清理可独立执行。

### 4. 边界情况修复

- **目标**：SSE 幂等、API 健康检查、任务超时、种子数据统一
- **涉及**：web, api, worker

### 中优先级

### 5. 单次闭环打通（LoopHandler 迭代执行）

- **目标**：Agent 包装层（AgentExecutor）已完成；LoopHandler 迭代循环仍是骨架（`loop-handler.ts` 始终返回 0 次迭代），需打通迭代执行闭环
- **涉及**：apps/worker/src/handlers/loop-handler.ts, 条件评估器
- **计划**：`plans/2026-06-25-agent-and-loop.md`（B/C 部分）

### 6. 通用 Agent Harness 框架

- **目标**：创建 `packages/agent-harness` 通用框架
- **前置**：#4 落地

### 7. Agent 测试评估框架

- **目标**：建立 Agent 行为的测试和评估体系
- **前置**：#5 落地

### 8. 特征提取与因子分析扩展

- **目标**：特征提取仅 3 类基础特征，需补技术指标/基本面特征；因子分析缺 IC 衰减/中性化/正交化/换手率
- **涉及**：ai-engine/features.py, factor-lab/evaluator.py

### 9. 策略分层 Timer 数据连续性

- **目标**：解决 DefaultComposite 中 Timer 历史数据不连续问题
- **涉及**：backtest-engine/composite_impl.py

### 10. 借鉴 OSkhQuant（3/7 已完成）

- **已完成**：技术指标库、A 股市场规则、OrderRequest.reason
- **待实施**：多标的回测增强、风控模块、绩效归因（当前仅多标的权益分解）

### 低优先级

### 11. 组合优化与模拟交易

- **目标**：组合优化（mean-variance/risk parity）当前空白；Paper Trading 缺失，回测→实盘之间无过渡桥梁
- **涉及**：strategies/sizers, strategy-runtime（新增 forward/paper 命令）

### 12. 多市场扩展路线图

- **目标**：港股/美股/期货/基金市场支持
- **当前不做**：按 AGENTS.md 规定，当前不做实盘和权限系统
