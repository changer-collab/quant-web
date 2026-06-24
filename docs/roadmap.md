# 待实施计划路线图

> 以下计划尚未实施，按优先级排列。已完成计划见 `completed-plans.md`。

## 高优先级

### 1. 历史报告持久化展示

- **目标**：前端接入 `/api/reports` 接口，页面刷新后历史报告仍在
- **涉及**：web/api-reports, web/useResearchWorkflow
- **计划**：`plans/2026-06-23-backtest-report-and-strategy.md` Task 2-3
- **前置**：回测闭环已打通（commit `32fd572`），API 报告接口已就绪

### 2. 真实数据接入与端到端验证

- **目标**：接入 AKShare 真实 A 股行情，跑通"数据采集 → 写入数据中心 → Python 回测 → 输出结果"闭环
- **涉及**：data-collector, data-center, data-client, backtest-engine
- **进度**：约 95%（AKShare 适配器已实现，批量导入待验证）

### 3. dual_ma 策略交易逻辑测试

- **目标**：验证金叉买入、死叉卖出、持仓状态切换等核心逻辑
- **涉及**：packages/strategies
- **计划**：`plans/2026-06-23-backtest-report-and-strategy.md` Task 4

### 4. 代码审查与质量加固

- **目标**：全仓库代码审查，补齐测试覆盖，修复集成缺口
- **涉及**：全部 packages + apps + services
- **关键短板**：集成验证不充分、能力扩展未落地

### 5. errors.md 局限修复

- **目标**：修复 6 个边界情况（SSE 幂等、API 健康检查、任务超时、种子数据统一等）
- **涉及**：web, api, worker
- **原则**：Worker 心跳复用轮询循环（不新增独立定时器），前端不新增主动后端请求

## 中优先级

### 6. 策略分层 Timer 数据连续性

- **目标**：解决 DefaultComposite 中 Timer 历史数据不连续问题
- **涉及**：backtest-engine/composite_impl.py
- **当前规避**：Selector 使用小 lookback，Timer 对数据不足返回 Hold

### 7. 借鉴 OSkhQuant（3/7 已完成）

- **已完成**：技术指标库、A 股市场规则、OrderRequest.reason
- **待实施**：多标的回测增强、风控模块、绩效归因、实盘模拟

## 低优先级

### 8. 项目阶段总结与优化

- **目标**：总结当前阶段成果，规划后续优化方向
- **状态**：待触发

### 9. 多市场扩展路线图

- **目标**：港股/美股/期货/基金市场支持
- **前提**：A 股市场规则稳定、数据采集器多源适配完成
- **当前不做**：按 AGENTS.md 规定，当前不做实盘和权限系统
