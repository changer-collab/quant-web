# apps/api/AGENT.md

## 必须遵守

- 所有回复使用中文。
- 保持 API 层薄，不把回测、训练、数据清洗逻辑塞进 API。
- 因子 CRUD 只做 HTTP 入口，因子计算和评估逻辑不塞进 API。
- 不引入权限系统、微服务或复杂网关，除非用户明确要求。
- 更新本目录能力或进度时，同步更新本目录 `README.md` 和 `AGENT.md`，并按需同步根级文档。

## 当前阶段

```text
已实现（Fastify + TypeScript）
```

已实现路由：

- 策略查询（GET /api/strategies）
- 任务提交/查询（POST/GET /api/tasks）
- 任务 SSE 流（GET /api/tasks/:id/stream）
- 内部任务路由（GET/POST /api/internal/tasks/*），供 Worker 轮询领取、上报任务状态/结果/失败
- 因子 CRUD + 评估触发 + 批量计算（/api/factors）
- 数据摘要查询（/api/data/instruments|bars|coverage|quality）
- 任务服务通过 TaskService 接口解耦 Worker（SqliteTaskService 持久化实现）
- 三层架构：Repository（Drizzle+SQL.js）→ Service（纯 TS，不依赖 Drizzle）→ Route（Fastify）
- StrategyConfigRepository：策略配置 CRUD + 透明配置历史记录
- DiagnosticRepository：诊断结果 CRUD + 过期清理
- StrategyConfigService / DiagnosticService：业务逻辑层，依赖 Repository 接口
- 路由通过 Fastify 装饰器（app.configService / app.diagnosticService）访问 Service
- 策略列表扩展：返回 category/subcategory/workflowReady + 扩展 params（chart_relevant/ui_constraints）
- Preview 端点（POST /api/strategies/:name/preview）：加载 K 线 → PreviewService 计算 SMA/EMA/RSI/MACD 叠加层 + 信号标注 → 返回 bars/overlays/signals/pagination/fingerprint
- PreviewService：纯 TypeScript 预览引擎，不依赖外部数学库，支持反向分页（cursor 翻页）
- ResultProcessor 注册表（services/result-processors/）：TaskType → ResultProcessor 映射，complete handler 退化为统一分派（≤25 行，无 per-type if/switch）
- BacktestResultProcessor：报告映射 + AI analysis 合并 + surrogate 清洗 + ReportRepository 持久化，保存失败时抛异常（任务标记 failed）
- DiagnosticsResultProcessor：诊断结果持久化 + resultId/resultType 信封输出
- ReportRepository 通过 app.decorate 注入（app.reportRepository），与既有 Service 注入模式一致

## 边界

API 只做 HTTP 入口和业务编排，不做：

```text
行情存储
事件驱动回测
模型训练
真实下单
低延迟执行
```