# 项目路线图

> 📋 2026-06-27 完整链条审计：[pipeline-audit-2026-06-27.md](./pipeline-audit-2026-06-27.md) — 15 个环节逐项评估，含 5 个致命缺陷和 10 个次优先缺口。

## 已完成计划

> 以下计划已全部实施完成，详细信息已沉淀到代码中。

| 日期 | 计划 | 涉及模块 |
|------|------|----------|
| 2026-06-16 | 因子评估报告优化 | factor-lab, web |
| 2026-06-16 | Python 引擎重塑 | backtest-engine, strategy-runtime, ai-engine, data-client |
| 2026-06-16 | 策略运行时流式输出 | strategy-runtime CLI, worker/python-bridge, API SSE, web EventSource |
| 2026-06-17 | 因子报告视觉优化（中性化表格对齐 + 相关性图谱） | web/factor-report |
| 2026-06-17 | 因子报告视觉优化 V2（族群回退表格 + 中性化卡片） | web/factor-report |
| 2026-06-17 | 策略分层解耦（选股/择时/仓位管理） | strategy-runtime, backtest-engine, strategies |
| 2026-06-18 | 回测报告完善 | web/report |
| 2026-06-18 | 前后端对接 | web/api, worker, API SSE |
| 2026-06-22 | 后端完善（回测报告与因子评估持久化） | api/report-repo, api/eval-repo, api/report-mapper |
| 2026-06-22 | 策略开发就绪（策略同步/数据导入/Worker 扩展/类型匹配） | api/strategy-sync, data-center/import-data, worker/main, api/task-service |
| 2026-06-23 | 回测单次闭环打通（equity_stats/CLI 衍生统计/obsidian-sync/前端字段修复） | backtest-engine/equity_stats, strategy-runtime/cli, web/factories |

---

## 待实施计划

### 高优先级

### 1. 历史报告持久化展示

- **目标**：前端接入 `/api/reports` 接口，页面刷新后历史报告仍在
- **涉及**：web/api-reports, web/useResearchWorkflow
- **前置**：回测闭环已打通（commit `32fd572`），API 报告接口已就绪

### 2. 真实数据接入与端到端验证

- **目标**：接入 AKShare 真实 A 股行情，跑通"数据采集 → 写入数据中心 → Python 回测 → 输出结果"闭环
- **涉及**：data-collector, data-center, data-client, backtest-engine
- **进度**：约 95%（AKShare 适配器已实现，批量导入待验证）
- **计划**：`plans/2026-06-24-data-and-e2e.md`

### 3. dual_ma 策略交易逻辑测试

- **目标**：验证金叉买入、死叉卖出、持仓状态切换等核心逻辑
- **涉及**：packages/strategies

### 4. 代码审查与质量加固

- **目标**：全仓库代码审查，补齐测试覆盖，修复集成缺口
- **涉及**：全部 packages + apps + services

### 5. 边界情况修复

- **目标**：修复 SSE 幂等、API 健康检查、任务超时、种子数据统一等边界情况
- **涉及**：web, api, worker

### 中优先级

### 6. Agent 包装层 + 单次闭环

- **目标**：构建统一的 AgentExecutor 接口，打通 LoopHandler 迭代执行闭环
- **涉及**：apps/worker/src/agents/, handlers/loop-handler.ts, 条件评估器
- **计划**：`plans/2026-06-25-agent-and-loop.md`

### 7. 通用 Agent Harness 框架

- **目标**：创建 `packages/agent-harness` 通用框架
- **前置**：#6 落地

### 8. Agent 测试评估框架

- **目标**：建立 Agent 行为的测试和评估体系
- **前置**：#7 落地

### 9. 策略分层 Timer 数据连续性

- **目标**：解决 DefaultComposite 中 Timer 历史数据不连续问题
- **涉及**：backtest-engine/composite_impl.py

### 10. 借鉴 OSkhQuant（3/7 已完成）

- **已完成**：技术指标库、A 股市场规则、OrderRequest.reason
- **待实施**：多标的回测增强、风控模块、绩效归因

### 低优先级

### 11. 多市场扩展路线图

- **目标**：港股/美股/期货/基金市场支持
- **当前不做**：按 AGENTS.md 规定，当前不做实盘和权限系统
