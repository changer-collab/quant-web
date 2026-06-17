# QuantForge

QuantForge 是一个面向个人量化研究者的量化策略研究平台。

当前阶段不是实盘交易，而是先打通研究原型闭环：

```text
选择策略 -> 配置研究参数 -> 运行回测或训练 -> 查看任务和报告 -> 迭代策略
```

## 当前阶段

项目已迁移到 pnpm + Turborepo monorepo 结构，当前可运行部分是 `apps/web`（前端研究原型）。

已完成的主要模块：

```text
apps/web              前端研究原型（React + TS + Vite），已对接真实后端
apps/api              HTTP API（Fastify），含 SSE 流式推送
apps/worker           异步任务 Worker，HTTP 轮询 API 领取任务
services/data-center  独立数据中心（SQLite + Drizzle，6 数据子域）
services/data-collector 数据采集器（6 数据源适配器，水位增量采集）
packages/backtest-engine 事件驱动回测引擎
packages/factor-lab   因子工坊（计算 + 评估调度）
packages/strategy-runtime 策略运行时接口（CLI NDJSON 流式输出）
packages/strategies   策略库（双均线、RSI）
```

真实回测闭环已打通：API → Worker → Python CLI → 结果回传 → 前端 SSE。

待完成：

```text
- AI 引擎（特征、标签、训练、预测、模型注册）
- 数据中心生命周期管理完善
- 真实数据源接入
- 实盘执行层
```

## 后续规划

```text
1. 继续稳定 apps/web，按需要引入路由
2. services/data-center 生命周期管理完善
3. packages/ai-engine 特征、标签、训练、预测和模型注册
4. services/data-collector 真实数据源接入
5. 高频增强
6. 实盘执行层
```

规划原则：

```text
先打通研究闭环，再补基础设施
先保持依赖边界清晰，再扩展能力
真实交易放到最后，并且必须单独设计执行层
```

## 项目结构

```text
apps/web              当前前端应用
apps/api              HTTP API（已实现，Fastify）
apps/worker           异步任务 Worker（已实现）
services/data-center  独立数据中心（已实现）
services/data-collector 数据采集器（已实现）
packages/backtest-engine 回测引擎（已实现）
packages/factor-lab   因子研发工坊（已实现）
packages/ai-engine    后续 AI 量化引擎
packages/strategy-runtime 策略运行时（已实现）
packages/strategies   策略库（已实现）
packages/common       公共类型（已移除，迁移至各所有者模块）
runtime/
```

## 本地运行

```bash
pnpm install
pnpm dev
```

## 验证

修改前端信息架构、策略模式、任务数据、文案或组件后，运行：

```bash
pnpm lint
pnpm test
pnpm build
```

## 更新约定

以后每次项目更新，都要同步更新：

```text
README.md   记录当前项目阶段、已完成进度、运行方式
AGENT.md    记录项目级执行规则：概述、技术栈、编码规范、流程、硬约束、陷阱
```

每个可独立开发的子项目目录也要维护自己的：

```text
README.md
AGENT.md
```

当前需要维护子项目文档的目录：

```text
apps/web
apps/api
apps/worker
services/data-center
services/data-collector
packages/backtest-engine
packages/ai-engine
packages/factor-lab
packages/strategy-runtime
packages/strategies
```

`runtime/` 是运行产物目录，不按独立开发项目维护文档；除非后续它变成明确的工具或服务模块。

如果更新涉及 Agent 规则、架构边界、目录边界或必须遵守的工作流，也要同步更新：

```text
AGENTS.md   记录多 Agent 角色定义、能力边界、工作范围、协作接口、角色专属规则
```

## 边界

当前只做研究和回测原型，不做：

```text
真实下单
券商连接
实盘低延迟交易
权限系统
策略市场
```

未来如果做实盘执行层，必须单独设计：

```text
market_gateway
order_gateway
risk_guard
broker_adapter
```

普通 API 和任务队列不能放在低延迟下单路径中。
