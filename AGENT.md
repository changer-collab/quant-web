# AGENT.md

## 项目概述

- 项目名：QuantForge，面向个人量化研究者的策略研究平台。
- 当前阶段：前后端端到端闭环已打通（回测/诊断 → API → Worker → Python CLI → 真实指标 → SSE → 前端展示）。canonical 策略分类、ConfigSnapshot、Preview、Task payload 校验、ResultProcessor 注册表均已落地。后续阶段见 [backend-sync-realign-integrated plan](docs/plans/2026-06-30-backend-sync-realign-integrated.md)。
- 核心闭环：选择策略 → 配置参数 → 运行回测/训练 → 查看任务和报告 → 迭代策略。
- 后续规划：稳定前端 → AI 引擎 → 高频增强 → 实盘执行层。

## 技术栈

- 包管理：pnpm workspaces monorepo
- 构建编排：Turborepo
- 工具链：ESLint flat config + Prettier + Vitest + TypeScript
- CI：GitHub Actions（`.github/workflows/ci.yml`）
- 前端：React + Vite + CSS（`apps/web`）
- API：Fastify（`apps/api`），SSE 流式推送
- Worker：HTTP 轮询 API 领取任务，PythonBridge 子进程调用 Python CLI
- 数据中心：SQLite + Drizzle ORM（`services/data-center`）
- 数据采集器：8 数据源适配器 + 水位增量采集（`services/data-collector`）
- Python 包：backtest-engine / factor-lab / strategy-runtime / ai-engine / strategies / data-client / obsidian-sync

## 编码规范

- 所有回复使用中文。
- 遵循 KISS 原则，非必要不要过度设计。
- 能用代码和清晰命名表达的，不写冗余说明。
- 不做无关重构，不修改与任务无关的文件。
- 前端组件保持小边界：状态协调放 `src/hooks/`，展示组件放 `src/components/`，App.tsx 只做组合渲染。
- 新增前端 UI 文案必须进入 `src/data/en.ts`、`src/data/zh.ts` 或 `UiCopy`，组件不硬编码固定语言文案。
- 不新增路由、状态库、后端、微服务，除非用户明确要求。
- 所有密钥和环境变量统一管理：项目根目录一个 `.env`（gitignored）+ 一个 `.env.example`（提交到 git）。各子项目不单独维护 `.env` 文件。
- Python 包纯读 `os.environ`，不引入 dotenv 依赖。由启动入口（Worker 子进程、CLI 等）负责加载 `.env` 注入环境变量。

## 工作流程

- 开始前先调研现有代码、目录和文档。
- 需求不明确时先确认；能从仓库中确认的事实不要问用户。
- 简单任务可直接执行；复杂任务先给文字方案并等用户确认。
- 每次项目更新同步 `README.md` 和 `AGENT.md`；涉及角色或架构边界时同步 `AGENTS.md`。
- 修改 `apps/web` 后运行：`npm test && npm run build`

## 硬性约束

- 当前不做：真实下单、券商连接、实盘低延迟交易、权限系统、策略市场。
- 未来实盘执行层必须单独设计：`market_gateway`、`order_gateway`、`risk_guard`、`broker_adapter`。
- 普通 API 和任务队列不能放进低延迟下单路径。

## 已知陷阱

- PowerShell 可能把 UTF-8 中文显示成乱码；用 Node 读取文件验证内容。
- 数据库路径解析：API/Worker 从子目录启动时，相对路径 `data/quant.db` 会解析失败。必须使用项目根目录解析函数定位 quant.db 绝对路径。Worker 调用 Python 子进程时必须设置 `cwd` 为项目根目录。
- 前端报告映射：`mapBacktestResultToReport` 必须映射所有被报告组件使用的字段，特别是 `executiveSummary.keyMetrics`。未映射字段会 fallback 到 MOCK_REPORT 硬编码值，而非后端返回的真实指标。
- 前端 MOCK fallback 陷阱：`useResearchWorkflow` 在 SSE 连接错误、任务失败或未选择策略时会 fallback 到模拟数据，界面不报错但结果是假的。验证回测结果是否真实时，必须对比 API 返回的 `metrics` 和前端显示的数值。
- Turborepo `outputs` 警告：stub 包没有 `dist/` 产物，turbo 会报 "no output files found" 警告，这是预期行为。
- `apps/web` 构建时 Vite 会 externalize `node:path` 和 `node:fs`（浏览器兼容性预期行为，不影响运行）。
- ConfigSnapshot 唯一真相源：任务 payload 必须带 configSnapshot，顶层 params 被拒绝（400）。Worker backtest-handler 保留 payload.params fallback 但标记 deprecated。
- ResultProcessor 注册表：API complete handler 通过 registry 分派，BacktestResultProcessor 保存失败会标记任务 failed（不再静默 console.error）。新加任务类型需注册对应 processor。
