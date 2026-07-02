# 根目录文档对齐 backend-sync-realign plan 设计

> 对齐基准：`docs/superpowers/plans/2026-06-30-backend-sync-realign-integrated.md` 的 Phase 0-5（已落地）。Phase 6-9 未完成，不在本次文档描述范围内。

## 目标

根目录 md 文件（README.md / AGENT.md / AGENTS.md / CLAUDE.md）当前滞后于已落地的 canonical 契约。本次更新让根文档与代码实际状态一致，使新 Agent 能从根文档快速理解已落地的核心契约与模式。

## 范围

- 对齐已落地状态（Phase 0-5）：canonical taxonomy、ConfigSnapshot、Preview、Task payload 校验、ResultProcessor 注册表、Repo DI
- 不描述 Phase 6-9 未完成内容（transitional 真实算法、回测 E2E configSnapshot 全链路、Python 通道收敛、死队列清理）
- 不重写 plan 内容，仅在 AGENT.md 用文件链接指向 plan

## 改动清单

### 1. CLAUDE.md — 删除

删除整个文件。理由：内容过时（"后端: Node.js + Express" 实际为 Fastify），与 AGENT.md 职责重复。

### 2. README.md

#### 2.1 核心闭环（第 5-11 行）

当前：
```
选择策略 → 配置参数 → 运行回测/训练 → 查看任务和报告 → 迭代策略
前后端端到端闭环已打通：前端提交回测 → API → Worker → Python CLI → 真实回测指标 → SSE 推送 → 前端报告显示。
```

更新为：
```
选择策略 → 配置参数 → 预览/诊断 → 运行回测 → 查看任务和报告 → 迭代策略
前后端端到端闭环已打通：前端提交回测/诊断 → API → Worker → Python CLI → 真实指标 → SSE 推送 → 前端报告显示。
配置读写、策略预览、因子/非因子诊断均已接入主链路。
```

#### 2.2 新增"核心契约"小节

放在"模块连接图"之前。内容：

```markdown
## 核心契约

- **策略分类**：`StrategyCategory` 三类（factor_based / non_factor / transitional），`StrategySubcategory` 十值（linear_multi_factor / index_enhancement / ml_nonlinear_factor / trend_cta / arbitrage / hft_microstructure / macro_quant / event_driven / e2e_ai_timeseries / event_sentiment_factor）。Python / API / 前端三层逐字对齐。
- **ConfigSnapshot**：策略配置的唯一真相源，含 schemaVersion / strategy / strategyVersion / category / subcategory / params / hash / updatedAt。任务 payload 强制带 configSnapshot，顶层 params 被拒绝。
- **TaskResultEnvelope**：SSE result 事件顶层含 `resultId` / `resultType`（diagnostics | backtest），完成后可恢复。
- **ResultProcessor 注册表**：API complete handler 通过注册表分派给 BacktestResultProcessor / DiagnosticsResultProcessor，Repo 走 Fastify DI。
- **Preview 契约**：`POST /api/strategies/:name/preview` 仅接受 chart_relevant 字段（非图表字段 422），合并 saved config 后计算。
```

#### 2.3 模块连接图与断点表

保持不变。plan 未涉及 obsidian-sync 断点（1-3、5-6）和 orchestrator（7），这些断点仍真实存在。

#### 2.4 "已连通链路"小节（第 63-73 行）

在 `apps/worker → apps/api → SSE → apps/web` 之后追加一行：
```
apps/api /api/strategies（catalog/config/preview）/api/diagnostics /api/tasks 已对齐 canonical 契约
```

#### 2.5 项目结构

保持不变。根文档只列模块级，子项目内部结构（services/repositories/result-processors）由各子项目 AGENT.md 维护。

### 3. AGENT.md

#### 3.1 项目概述"当前阶段"（第 6 行）

当前：
```
- 当前阶段：前端研究原型稳定，前后端端到端闭环已打通（前端提交回测 → API → Worker → Python CLI → 真实回测指标 → SSE 推送 → 前端报告显示）。
```

更新为：
```
- 当前阶段：前后端端到端闭环已打通（回测/诊断 → API → Worker → Python CLI → 真实指标 → SSE → 前端展示）。canonical 策略分类、ConfigSnapshot、Preview、Task payload 校验、ResultProcessor 注册表均已落地。后续阶段见 [backend-sync-realign-integrated plan](docs/superpowers/plans/2026-06-30-backend-sync-realign-integrated.md)。
```

#### 3.2 已知陷阱（第 49-56 行）补充两条

```markdown
- ConfigSnapshot 唯一真相源：任务 payload 必须带 configSnapshot，顶层 params 被拒绝（400）。Worker backtest-handler 保留 payload.params fallback 但标记 deprecated。
- ResultProcessor 注册表：API complete handler 通过 registry 分派，BacktestResultProcessor 保存失败会标记任务 failed（不再静默 console.error）。新加任务类型需注册对应 processor。
```

#### 3.3 技术栈、编码规范、工作流程、硬性约束

保持不变，仍准确。

### 4. AGENTS.md

#### 4.1 "类型归属原则"补列新类型

在现有清单后追加：

```text
策略运行时（strategy-runtime，Python）另拥有：
  StrategyCategory, StrategySubcategory（canonical 枚举值，TS 层镜像）

API（apps/api，TypeScript）拥有：
  ConfigSnapshot, ConfigSchemaVersion,
  FactorBasedConfigParams, NonFactorConfigParams, TransitionalConfigParams,
  TaskResultEnvelope, DiagnosticsTaskPayload, BacktestTaskPayload,
  DiagnosticResultWire,
  ResultProcessor, ResultProcessorContext, ResultProcessorOutput
```

说明：StrategyCategory/Subcategory 的 canonical 定义在 Python strategy-runtime，TS 层镜像；ConfigSnapshot 等是 API 定义的 wire 契约类型，Python 侧按需消费 dict。

#### 4.2 "协作接口"措辞对齐

当前（AGENTS.md "协作接口"小节）：
```
- 前端 Agent 通过 API Agent 获取策略、任务、报告和数据摘要；当前阶段用前端模拟数据。
- 前端 Agent 通过因子工坊页面展示因子定义、评估结果和因子引用；当前阶段用前端模拟数据。
```

更新为：
```
- 前端 Agent 通过 API Agent 获取策略、任务、报告和数据摘要；当前阶段消费真实 API 数据，部分空态场景仍用 mock 占位。
- 前端 Agent 通过因子工坊页面展示因子定义、评估结果和因子引用；当前阶段用前端模拟数据。
```

仅改第一处（策略/任务/报告已接真实数据），第二处（因子工坊页面）保持不变——plan 未涉及因子工坊前端。

#### 4.3 角色定义、能力边界、依赖白名单、角色专属规则

保持不变。plan 未改变模块边界与依赖关系。

## 验证

- 改动后 `git diff` 仅涉及 4 个文件：CLAUDE.md（删除）、README.md、AGENT.md、AGENTS.md
- 不涉及代码、测试、配置
- 无需运行 `pnpm test` / `pnpm build`（纯文档改动）
- 人工核对：每处措辞不超范围，不描述 Phase 6-9 未完成内容
