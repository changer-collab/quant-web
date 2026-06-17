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
- CSS 动效系统：全局 keyframes（fadeIn/slideUp/slideDown/scaleIn/glow/pulse）、导航逐项入场、Hero 顺序入场动画、按钮 hover/active 微交互动效、因子评估 Tab 切换过渡动画
- CSS 视觉优化（Dark Quant Command Center）：渐变边框面板（双色渐变 border-box + padding-box）、双层径向背景光晕、设计令牌体系增强（渐变/阴影/动效曲线/z-index/圆角）、字体预加载（Fraunces 展示字体 + JetBrains Mono 代码字体）、按钮涟漪动效（radial-gradient 跟随鼠标）、图表示意重设计（渐变柱状图 + 双色趋势线 + 脉冲买卖标记）、卡片悬浮上浮阴影、导航激活指示器发光、模式标签底部渐变指示条、表格行渐变悬停、活动时间线条目位移、页面入场过渡动画
- 内容优化：策略数据 3→12 条、Tick 流 4→20 条、任务历史 3→8 条、因子评估 2→4 个活跃因子
- 本地化一致性：zh.ts 术语标准化（Factor→因子型、Daily→日频、Tick→逐笔、IC→信息系数）
- 品牌文案升级：brandTagline 和 heroEyebrow 统一、导航 eyebrow 去冗余
- 状态标签动态化：failedState/queuedState/stableState/draftState/trainingState 提取至 UiCopy，新增 localizeJobState() 函数
- 指标说明和空状态文案：metricAnnotations（收益/回撤/夏普上下文说明）、emptyStrategies/emptyJobs/emptyFactors 占位文案
- 自定义 hooks：useLanguage、useResearchWorkflow
- Error Boundary 已集成
- 前端 Mock 数据已按数据中心 6 个子域（reference / market / l2 / fundamental / event）组织，策略列表引用标的元数据
- 前端测试 81 个用例（含 21 个 Mock 数据验证测试）
- 前端页面底部已语境化：Dashboard 活动时间线、策略中心卡片矩阵、回测记录、实验对比表、数据中心覆盖面板，取代统一的策略表格
- pnpm monorepo 工作区已配置，所有模块已注册 workspace 包名
- ESLint + Prettier + Vitest 统一工具链已配置
- Turborepo 已引入（并行构建 + 缓存加速）
- GitHub Actions CI 流水线已配置（基于 Turborepo）
- pnpm test、pnpm build、pnpm lint 已通过（0 lint 错误，202 测试通过）
- packages/common 核心类型基座已迁移至各所有者模块（类型归属模型），common 包已移除
- packages/strategy-runtime 策略运行时接口已实现（Strategy、StrategyContext、StrategyMeta、StrategyResult、StrategyState、OrderRequest），3 个测试通过
- packages/factor-lab 因子工坊已扩展（因子计算函数 returnRate/movingAverage/volatility/momentum、因子注册中心 FactorRegistry、因子计算引擎 FactorEngine、因子评估调度接口 FactorEvalScheduler），11 个测试通过
- services/data-center 独立数据中心已实现（SQLite + Drizzle ORM，6 个数据子域类型定义、17 个 SQLite Repository、6 个 Provider、工厂函数 createDataCenter()、CloseError 错误类型、并发安全 close 生命周期、PIT 过滤），43 个测试通过
- services/data-collector 数据采集器已实现（6 个数据源适配器：CSV/Tushare/AKShare/Baostock/efinance/yfinance，适配器注册中心、数据清洗、水位增量采集、预设任务工厂、多源优先级回退），58 个测试通过
- packages/backtest-engine 事件驱动回测引擎已实现（EventBus、MarketReplay、Matcher、Portfolio、Metrics、BacktestRunner），31 个测试通过
- packages/strategies 策略库已实现（双均线策略 DualMAStrategy、RSI 策略 RSIStrategy），12 个测试通过
- apps/worker 异步任务 Worker 已实现（TaskQueue 内存队列、TaskHandler 接口、Worker 主类、BacktestHandler/FactorComputeHandler/FactorEvalHandler 三个处理器），14 个测试通过
- apps/api HTTP API 入口已实现（Fastify 应用、策略查询、任务提交/查询、因子 CRUD + 评估触发 + 批量计算、数据摘要查询），21 个测试通过
- workspace 依赖协议已统一为 workspace:*
- .npmrc 已配置（shamefully-hoist、strict-peer-dependencies）
```

当前还没做：

```text
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
10. ~~apps/worker 异步任务闭环~~（已完成）
11. ~~apps/api 策略、任务、报告 API~~（已完成）
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
