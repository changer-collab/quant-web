# AGENTS.md

## 角色定义

- 项目协调 Agent：维护根级项目阶段、规划、目录边界和跨模块规则。
- 前端 Agent：负责 `apps/web`。
- API Agent：负责 `apps/api`。
- Worker Agent：负责 `apps/worker`。
- 数据中心 Agent：负责 `services/data-center`。数据中心是通用数据服务，不绑定任何上层业务（不仅服务于 QuantForge），可独立部署供多项目消费。数据中心只负责存储、标准化和查询，不负责数据采集。
- 数据采集器 Agent：负责 `services/data-collector`。数据采集器是独立的数据管道服务，负责从外部数据源拉取原始数据、清洗标准化后写入数据中心。可独立部署，按需启停。
- 回测引擎 Agent：负责 `packages/backtest-engine`。
- AI 引擎 Agent：负责 `packages/ai-engine`。
- 策略运行时 Agent：负责 `packages/strategy-runtime`。
- 因子工坊 Agent：负责 `packages/factor-lab`。因子工坊只做因子定义、计算、评估和注册的类型与接口，不做回测撮合和策略执行。
- 策略库 Agent：负责 `packages/strategies`。
- 循环引擎 Agent：负责 `packages/loop-engine`。循环引擎只定义循环工程（Loop Engineering）的类型骨架与条件判断纯函数接口，不实现调度引擎、不持久化状态、不承载核心算法。当前阶段为预留骨架，单次闭环打通后再实现。

角色之间边界要清晰，重叠越少越好。如果两个 Agent 的职责分不开，说明角色该合并或者该重新拆。

## 能力边界

- 项目协调 Agent 只维护规则、规划、文档同步和边界判断，不替代子项目实现。
- 前端 Agent 只做研究原型界面、前端状态、静态/模拟数据展示和前端测试。
- API Agent 只做 HTTP 入口和轻量业务编排，不做数据清洗、回测计算、模型训练。
- Worker Agent 只做异步任务编排，不实现策略、撮合、模型算法和数据清洗。
- 数据中心 Agent 只做存储、标准化、覆盖率、质量和查询。数据中心是通用数据服务，不绑定任何上层业务，可独立部署供多项目消费。数据中心内部分为 6 个数据子域：reference（参考数据）、market（L1 行情）、l2（L2 行情）、fundamental（基本面，默认 PIT 过滤）、event（资讯事件）、quality（数据质量校验）。数据中心不负责数据采集，数据由 data-collector 写入。
- 数据采集器 Agent 只做数据拉取、清洗和写入数据中心。数据采集器不存储数据、不提供查询接口、不感知上层业务逻辑。数据采集器通过适配器模式支持多数据源（CSV、Tushare、AKShare 等），通过水位机制实现增量采集。
- 回测引擎 Agent 只做事件回放、撮合模拟、持仓、资金曲线、指标和结果导出。
- AI 引擎 Agent 只做特征、标签、训练、预测、评估、模型注册、报告分析文本生成。报告分析文本生成当前作为 AI 引擎的子职责（放在 `report_analysis/` 子模块），后续要解耦为独立模块。
- 策略运行时 Agent 只定义策略接口、上下文、生命周期和运行适配。
- 因子工坊 Agent 只做因子定义、计算、评估和注册的类型与接口；因子评估指标（IC、分组收益、分层回测）的计算委托给回测引擎。
- 策略库 Agent 只写策略实现、策略样例和策略元数据。
- 循环引擎 Agent 只定义循环生命周期类型（状态、配置、迭代记录）、终止条件判断的纯函数接口和循环汇总结构；不实现调度引擎、不做状态持久化、不直接调用回测/AI/因子引擎、不直接读数据中心、不处理 HTTP。循环的调度编排由 Worker 负责，循环状态持久化由 Worker 通过 API 任务表实现。

## 工作范围

```text
项目协调 Agent       -> README.md, AGENT.md, AGENTS.md, 子项目 README.md/AGENT.md
前端 Agent           -> apps/web
API Agent            -> apps/api
Worker Agent         -> apps/worker
数据中心 Agent       -> services/data-center
数据采集器 Agent     -> services/data-collector
回测引擎 Agent       -> packages/backtest-engine
AI 引擎 Agent        -> packages/ai-engine（含 report_analysis 子模块）
策略运行时 Agent     -> packages/strategy-runtime
因子工坊 Agent       -> packages/factor-lab
策略库 Agent         -> packages/strategies
循环引擎 Agent       -> packages/loop-engine
```

`runtime/` 是运行产物目录，不分配开发 Agent。

## 协作接口

- 前端 Agent 通过 API Agent 获取策略、任务、报告和数据摘要；当前阶段用前端模拟数据。
- 前端 Agent 通过因子工坊页面展示因子定义、评估结果和因子引用；当前阶段用前端模拟数据。
- API Agent 可以提供因子 CRUD 和评估触发的 HTTP 入口，因子计算逻辑由 Worker 编排。
- Worker Agent 可以编排因子批量计算和因子评估任务，调用 AI 引擎做特征提取。
- 数据中心 Agent 只向外提供标准化数据和质量信息，不调用策略、回测或 AI。
- 数据中心 Agent 为因子计算提供标准化行情数据，不感知因子逻辑。
- 数据中心 Agent 不负责数据采集，数据由 data-collector 写入。
- 数据采集器 Agent 只向数据中心写入标准化数据，不直接为上层提供服务。
- 数据采集器 Agent 不感知因子、策略、回测等业务逻辑。
- 回测引擎 Agent 通过策略运行时加载策略，输入由 Worker 准备。
- 回测引擎 Agent 承载因子评估指标（IC、Rank IC、排序分组收益、分层回测）的计算，因子是回测引擎的一种输入维度。
- AI 引擎 Agent 输出预测、评分、模型指标，由 Worker 或回测流程使用。
- AI 引擎 Agent 的特征提取能力可被因子挖掘流程复用，但因子评估（IC、分组收益、分层回测）不是 AI 引擎的职责。
- 循环引擎 Agent 只向 Worker 提供循环类型定义和条件判断纯函数接口；循环的每次迭代是 Worker 编排的一个子任务，子任务调用回测引擎、AI 引擎或因子工坊。
- 循环引擎 Agent 不直接调度迭代，不持有循环运行状态；循环状态由 Worker 通过 API 任务表读写。
- 循环引擎 Agent 的迭代结果（IterationRecord）只存引用（子任务 ID、结果摘要），不内联回测/AI/因子的完整结果类型，避免跨包类型耦合。

### 类型归属原则

每个类型只定义一次，放在其"所有者"模块中，其他模块通过合法依赖链获取。不设中转包。

```text
数据中心（data-center，TypeScript）拥有：
  TimeFrame, Instrument, Bar, Tick, MarketEvent, ResearchMode

策略运行时（strategy-runtime，Python）拥有：
  OrderSide, OrderType, OrderStatus, Order,
  Trade, Position, Account,
  StrategyParamDef, ParamType,
  TaskStatus, TaskType,
  QuantError

回测引擎（backtest-engine，Python）拥有：
  BacktestConfig, BacktestMetrics, BacktestResult, EquityPoint,
  DEFAULT_INITIAL_CASH, DEFAULT_SLIPPAGE

因子工坊（factor-lab，Python）拥有：
  FactorDefinition, FactorStatus, FactorEvalTab,
  FactorMetrics, FactorRow, FactorEvaluationResult

循环引擎（loop-engine，Python）拥有：
  LoopType, LoopStatus, IterationStatus,
  LoopConfig, IterationRecord, LoopRecord,
  LoopCondition, LoopSummary
```

TS 层（api/worker）需要的类型在各自 `types.ts` 中内联，与 Python 侧保持值对齐。

允许依赖（**白名单制——未列出即不允许**）：

```text
apps/api -> services/data-center
apps/worker -> services/data-center
apps/worker -> services/data-collector

packages/data-client -> packages/strategy-runtime
packages/strategy-runtime -> packages/data-client
packages/strategy-runtime -> packages/ai-engine
packages/backtest-engine -> packages/strategy-runtime
packages/backtest-engine -> packages/factor-lab
packages/factor-lab -> packages/strategy-runtime
packages/factor-lab -> packages/data-client
packages/ai-engine -> packages/data-client
packages/strategies -> packages/strategy-runtime
packages/obsidian-sync -> packages/data-client
packages/obsidian-sync -> packages/strategy-runtime
packages/obsidian-sync -> packages/backtest-engine
packages/obsidian-sync -> packages/factor-lab
packages/loop-engine -> (无外部依赖，纯类型骨架)
services/data-collector -> services/data-center
```

TS 层内部通信：

- API 与 Worker 不共享进程状态，Worker 通过 HTTP 轮询 API 的 `/api/internal/tasks/*` 端点领取、上报任务。
- 前端通过 SSE `/api/tasks/:id/stream` 接收任务事件（progress/log/result/error）。

TS ↔ Python 通信：Worker 通过 `PythonBridge`（子进程 JSON 协议）调用 `quantforge_strategy.cli`，不直接 import Python 包。循环编排同样由 Worker 通过 PythonBridge 驱动，loop-engine 不自带进程入口。

## 角色专属规则

- 项目协调 Agent：每次项目更新同步根 `README.md` 和 `AGENT.md`；涉及角色或架构边界时同步 `AGENTS.md`。
- 项目协调 Agent：每个可独立开发子项目必须维护自己的 `README.md` 和 `AGENT.md`。
- 前端 Agent：修改 `apps/web` 信息架构、策略模式、任务数据、文案或组件后运行 `npm test`、`npm run build`、`npm list --depth=0`。
- 前端 Agent：不引入路由、状态库、后端请求，除非用户明确要求。
- API Agent：保持 API 层薄，不把计算逻辑塞进 HTTP 层；因子 CRUD 只做 HTTP 入口，因子计算和评估逻辑不塞进 API。提供 `/api/internal/tasks/*` 等内部端点供 Worker 领取和上报任务，内部端点不对外暴露业务语义。
- Worker Agent：只编排异步任务，不承载核心算法；因子批量计算和因子评估是合法的异步任务类型，但核心算法委托给 AI 引擎和回测引擎。Worker 必须是独立可部署进程，通过 HTTP 轮询 API 领取任务，不得与 API 共享内存队列或进程状态。
- 数据中心 Agent：不处理策略、回测、AI 训练和网站任务调度；不感知因子定义和因子计算逻辑；不负责数据采集，数据由 data-collector 写入。数据中心是通用数据服务，不绑定任何上层业务，可独立部署。
- 数据采集器 Agent：不存储数据、不提供查询接口、不感知上层业务逻辑；只通过数据中心的写入接口推送标准化数据。数据采集器可独立部署，按需启停。
- 回测引擎 Agent：不直接读取数据中心，不直接处理 HTTP；因子评估（IC 曲线、排序分组收益、分层回测）是回测引擎的合法能力，因子是回测引擎的一种输入维度。
- AI 引擎 Agent：不做回测撮合，不做实盘执行；特征提取可被因子挖掘复用，但因子评估指标的计算不是 AI 引擎的职责。报告分析文本生成放在 `report_analysis/` 子模块，接口设计为"输入 dict，输出文本"，不依赖 BacktestResult 等业务类型，避免跨包类型耦合。当前用规则引擎+模板生成，预留 LLM 接口。
- 策略运行时 Agent：接口优先稳定，避免过度抽象；策略运行时可 re-export 数据客户端的行情类型（Bar、Tick、TimeFrame 等），供下游模块通过合法依赖链获取；CLI 入口是 Worker 子进程调用的唯一入口。
- 因子工坊 Agent：因子定义和计算接口优先稳定；因子评估指标的计算不在此实现，委托给回测引擎。
- 策略库 Agent：策略不直接依赖网站后端。
- 循环引擎 Agent：当前阶段只定义类型骨架（LoopType/LoopStatus/IterationStatus/LoopConfig/IterationRecord/LoopRecord/LoopCondition/LoopSummary），不实现调度引擎、不实现状态持久化、不自带进程入口；循环调度始终由 Worker 负责，循环状态持久化始终由 Worker 通过 API 任务表实现；迭代结果只存引用和摘要，不内联其他引擎的完整结果类型；单次闭环（backtest → obsidian-sync、backtest → web 报告展示）打通后才进入循环引擎的实现阶段。

## 全局硬性规则

- 所有回复使用中文。
- 遵循 KISS 原则，非必要不要过度设计。
- 先调研现有代码和目录，再提出方案或修改代码。
- 不修改无关文件。
- 不为了记录过程创建额外文档；用户明确要求时除外。
- 当前不做真实下单、券商连接、实盘低延迟交易、权限系统、策略市场。
- 未来实盘执行层必须单独设计，不允许把普通 API 和任务队列放进低延迟下单路径。
- 所有密钥和环境变量统一管理：项目根目录一个 `.env`（gitignored）+ 一个 `.env.example`（提交到 git）。各子项目不单独维护 `.env` 文件。Python 包纯读 `os.environ`，不引入 dotenv 依赖，由启动入口负责加载。
- **Git 分支与提交约定**：
  - 本地开发统一使用 `changer` 分支，不要无缘无故创建新的分支。#这里changer可以改成共同开发者自己的分支
  - 开发完成后在 `changer` 分支提交。
  - 推送时使用 `git push origin changer`，不要直接向 `main` 分支推送。
  - 推送完成后，使用 `gh pr create` 创建从 `changer` 到 `main` 的 Pull Request（若已有同名 PR 则跳过）。

## 子项目规则引用

操作任何子项目前，**必须先读取**该子项目的 `AGENT.md`，以其规则为准。以下为完整引用清单：

<!-- @include: apps/web/AGENT.md -->

<!-- @include: apps/api/AGENT.md -->

<!-- @include: apps/worker/AGENT.md -->

<!-- @include: services/data-center/AGENT.md -->

<!-- @include: services/data-collector/AGENT.md -->

<!-- @include: packages/backtest-engine/AGENT.md -->

<!-- @include: packages/ai-engine/AGENT.md -->

<!-- @include: packages/strategy-runtime/AGENT.md -->

<!-- @include: packages/factor-lab/AGENT.md -->

<!-- @include: packages/strategies/AGENT.md -->

<!-- @include: packages/loop-engine/AGENT.md -->

**执行规则**：当任务涉及上述某个子项目时，Agent 必须先用 Read 工具读取对应的 `AGENT.md`，然后以该文件的规则为约束执行任务。如果子项目 AGENT.md 与根级 AGENTS.md 冲突，以根级为准。
