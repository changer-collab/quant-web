# QuantForge

QuantForge 是一个面向个人量化研究者的量化策略研究平台。

当前阶段不是实盘交易，而是先打通研究原型闭环：

```text
选择策略 -> 配置研究参数 -> 运行回测或训练 -> 查看任务和报告 -> 迭代策略
```

## 当前阶段

项目已经迁移到 monorepo 结构，当前可运行部分是：

```text
apps/web
```

当前处于前端研究原型稳定阶段。

前端状态：

```text
React + TypeScript + Vite + CSS
```

当前已完成：

```text
- apps/web 前端原型可运行
- 主导航保持研究主流程
- 策略研究台支持传统量化、高频研究、AI 量化三种模式和模式化默认配置面板
- 前端已支持内存态研究闭环：运行研究 -> 任务中心查看配置摘要 -> 查看统一报告摘要和运行配置诊断
- 中文/英文界面文案已恢复为可读文本
- appData.ts 已拆分为 accessors / factories / localization 三模块，原文件保留为 re-export 入口
- CSS 已模块化：全局 tokens + 各组件 CSS Modules
- 自定义 hooks：useLanguage、useResearchWorkflow
- Error Boundary 已集成
- 前端 Mock 数据已按数据中心 6 个子域（reference / market / l2 / fundamental / event）组织，策略列表引用标的元数据
- 前端测试 81 个用例（含 21 个 Mock 数据验证测试）
- pnpm monorepo 工作区已配置，所有模块已注册 workspace 包名
- ESLint + Prettier + Vitest 统一工具链已配置
- Turborepo 已引入（并行构建 + 缓存加速）
- GitHub Actions CI 流水线已配置（基于 Turborepo）
- pnpm test、pnpm build、pnpm lint 已通过（0 lint 错误，186 测试通过）
- packages/common 核心类型基座已实现（行情、订单、持仓、任务、策略参数、错误类、常量），14 个测试通过
- packages/strategy-runtime 策略运行时接口已实现（Strategy、StrategyContext、StrategyMeta、StrategyResult、StrategyState、OrderRequest），3 个测试通过
- packages/factor-lab 因子工坊骨架已实现（因子定义 / 计算 / 评估 / 注册类型），3 个测试通过
- services/data-center 独立数据中心已实现（SQLite + Drizzle ORM，6 个数据子域类型定义、17 个 SQLite Repository、6 个 Provider、工厂函数 createDataCenter()），27 个测试通过
- services/data-collector 数据采集器已实现（6 个数据源适配器：CSV/Tushare/AKShare/Baostock/efinance/yfinance，适配器注册中心、数据清洗、水位增量采集、预设任务工厂、多源优先级回退），58 个测试通过
- packages/backtest-engine 事件驱动回测引擎已实现（EventBus、MarketReplay、Matcher、Portfolio、Metrics、BacktestRunner），31 个测试通过
- packages/strategies 策略库已实现（双均线策略 DualMAStrategy、RSI 策略 RSIStrategy），12 个测试通过
- workspace 依赖协议已统一为 workspace:*
- .npmrc 已配置（shamefully-hoist、strict-peer-dependencies）
```

当前还没做：

```text
- 后端 API
- Worker 异步任务
- AI 引擎实现
- 真实交易
- 数据中心生命周期管理（close()、错误处理、PIT 过滤）
- 真实数据源接入（AKShare/Tushare 等适配器实际数据拉取）
```

## 后续规划

```text
1. ~~packages/common 核心类型基座~~（已完成）
2. 继续稳定 apps/web，按需要引入路由
3. ~~packages/strategy-runtime 策略运行接口~~（已完成）
4. ~~services/data-center 独立数据中心~~（已完成）
5. ~~services/data-collector 数据采集器~~（已完成）
6. services/data-center 生命周期管理（close()、错误处理、PIT 过滤、水位机制）
7. ~~packages/backtest-engine 事件驱动回测引擎~~（已完成）
8. ~~packages/factor-lab 因子研发工坊骨架~~（已完成，待扩展）
9. ~~packages/strategies 策略库~~（已完成）
10. apps/worker 异步任务闭环
11. apps/api 策略、任务、报告 API
12. apps/web 对接真实后端
13. packages/ai-engine 特征、标签、训练、预测和模型注册
14. services/data-collector 真实数据源接入
15. 高频增强
16. 实盘执行层
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
apps/api              后续 HTTP API
apps/worker           后续异步任务 Worker
services/data-center  后续独立数据中心
packages/backtest-engine
packages/ai-engine
packages/strategy-runtime
packages/strategies
packages/common
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
packages/common
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
