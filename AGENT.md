# AGENT.md

## 项目概述

- 项目名：QuantForge。
- 定位：面向个人量化研究者的量化策略研究平台。
- 当前阶段：前端研究原型稳定阶段，数据中心生命周期管理（close 并发安全 + 错误处理 + PIT 过滤）已完成，数据采集器研发完成，因子工坊已扩展，Worker 异步任务编排已完成，API HTTP 入口已实现，类型归属模型已落地（移除 common 包，每个类型只定义在其所有者模块中），策略运行时流式输出已完成（Python CLI NDJSON 事件流 → PythonBridge 流式读取 → API SSE 端点 → 前端 EventSource 实时更新）。
- 当前可运行项目：`apps/web`。
- 当前目标：继续打磨前端研究闭环（页面底部已语境化各页内容），不做真实交易。
- 核心闭环：选择策略 -> 配置研究参数 -> 运行回测或训练 -> 查看任务和报告 -> 迭代策略。
- 当前前端闭环支持内存态模式化研究配置摘要，运行后写入任务和报告诊断。
- 后续规划：稳定前端 -> 前端对接 -> AI 引擎 -> 高频增强 -> 实盘执行层。

## 技术栈与目录结构

- 包管理：pnpm workspaces monorepo，根 `pnpm-workspace.yaml`。
- 构建编排：Turborepo（`turbo.json`），并行构建 + 缓存加速。
- 工具链：ESLint flat config + Prettier + Vitest + TypeScript。
- CI：GitHub Actions（`.github/workflows/ci.yml`），基于 Turborepo 编排 lint/test/build。
- pnpm 配置：`.npmrc`（shamefully-hoist、strict-peer-dependencies）。
- workspace 依赖协议：统一 `workspace:*`。
- `apps/web`（`@quant/web`）：React + TypeScript + Vite + CSS，当前前端原型。
- `apps/api`（`@quant/api`）：HTTP API，Fastify 框架，已实现（策略查询、任务提交/查询、因子 CRUD + 评估触发 + 批量计算、数据摘要查询、SSE 流式推送 `/api/tasks/:id/stream`），21 个测试通过。
- `apps/worker`（`@quant/worker`）：异步任务 Worker，已实现（TaskQueue 内存队列、TaskHandler 接口、Worker 主类、BacktestHandler/FactorComputeHandler/FactorEvalHandler 三个处理器、流式事件回调），14 个测试通过。
- `services/data-center`（`@quant/data-center`）：独立数据中心，SQLite + Drizzle ORM，6 个数据子域类型定义、17 个 SQLite Repository、6 个 Provider，已实现（含 CloseError、并发安全 close、PIT 过滤），43 个测试通过。
- `services/data-collector`（`@quant/data-collector`）：数据采集器，6 个数据源适配器（CSV/Tushare/AKShare/Baostock/efinance/yfinance），适配器注册中心、数据清洗、水位增量采集、预设任务工厂、多源优先级回退，已实现。
- `packages/backtest-engine`（`@quant/backtest-engine`）：事件驱动回测引擎，已实现（EventBus、MarketReplay、Matcher、Portfolio、Metrics、BacktestRunner），31 个测试通过。
- `packages/ai-engine`（`@quant/ai-engine`）：后续 AI 量化引擎，未实现。
- `packages/strategy-runtime`（`@quant/strategy-runtime`）：策略运行时接口，已实现（Strategy、StrategyContext、StrategyMeta、StrategyResult、StrategyState、OrderRequest），CLI 支持 NDJSON 流式输出（progress/log/result/error 事件）。
- `packages/factor-lab`（`@quant/factor-lab`）：因子研发工坊，已扩展（因子计算函数、因子注册中心、因子计算引擎、因子评估调度接口），11 个测试通过。
- `packages/strategies`（`@quant/strategies`）：策略库，已实现（双均线策略 DualMAStrategy、RSI 策略 RSIStrategy），12 个测试通过。
- `runtime/`：运行产物目录，不按独立开发项目维护。
- 共享 TypeScript 配置：根 `tsconfig.base.json`，各模块通过 `extends` 继承。

## 编码规范

- 所有回复使用中文。
- 遵循 KISS 原则，非必要不要过度设计。
- 能用代码和清晰命名表达的，不写冗余说明。
- 不做无关重构，不修改与任务无关的文件。
- 前端交互必须服务真实研究动作，不把静态卡片全部做成按钮。
- 前端组件保持小边界：状态协调放自定义 hooks（`src/hooks/`），展示组件放 `src/components/`，数据和文案放 `src/data/`，App.tsx 只做组合渲染。
- 新增前端 UI 文案必须进入 `src/data/en.ts`、`src/data/zh.ts` 或 `UiCopy`，组件不硬编码固定语言文案。
- `CSI 500`、`XGBoost`、`Level1` 等专有名词可以保留原样。
- 不新增路由、状态库、后端、微服务，除非用户明确要求或已有计划要求。

## 工作流程

- 开始前先调研现有代码、目录和文档。
- 需求不明确时先确认；能从仓库中确认的事实不要问用户。
- 简单任务可直接执行；复杂任务先给文字方案并等用户确认。
- 每次项目更新都同步更新根 `README.md` 和 `AGENT.md`。
- 如果更新涉及 Agent 规则、角色边界、架构边界或目录边界，同步更新根 `AGENTS.md`。
- 每个可独立开发子项目都维护自己的 `README.md` 和 `AGENT.md`。
- 修改 `apps/web` 信息架构、策略模式、任务数据、文案或组件后运行：

```bash
cd apps/web
npm test
npm run build
npm list --depth=0
```

## 硬性约束

- 当前不做真实下单。
- 当前不做券商连接。
- 当前不做实盘低延迟交易。
- 当前不做权限系统。
- 当前不做策略市场。
- 数据中心不依赖回测引擎和策略库。
- 回测引擎不直接依赖 `apps/api`。
- 策略库不直接依赖 `apps/api`。
- 普通 API 和任务队列不能放进低延迟下单路径。
- 未来实盘执行层必须单独设计：`market_gateway`、`order_gateway`、`risk_guard`、`broker_adapter`。

## 已知陷阱

- PowerShell 可能把 UTF-8 中文显示成乱码；用 Node 读取文件验证内容。
- 当前 Git 状态包含 monorepo 迁移：根目录旧前端文件删除，`apps/web` 为新位置；不要回滚这类迁移。
- 沙箱内运行 `npm test` 或 `npm run build` 可能遇到 `esbuild spawn EPERM`；必要时按权限流程在沙箱外验证。
- 空目录不会被 Git 跟踪；需要进入版本管理时必须有明确文件，且先确认目的。
- `runtime/` 是运行产物目录，不要把业务源码放进去。
- 文档要短、明确、可执行；过时内容定期删除。
- Turborepo 的 `outputs` 警告：stub 包（api、ai-engine）没有 `dist/` 产物，turbo 会报 "no output files found" 警告，这是预期行为，待包实现后自动消除。
- `apps/web` 构建时 Vite 会 externalize `node:path` 和 `node:fs`（来自 data-center 的 SQLite 连接），这是浏览器兼容性预期行为，不影响运行。
