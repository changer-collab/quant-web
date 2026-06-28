# QuantWeb

AI 驱动的量化交易平台 — 通过 Claude Code Agent 自治分析市场、执行策略、生成交易报告。

## 项目结构

- `apps/web/` — 前端 (React)
- `apps/api/` — API 服务 (Node.js + Express/Fastify)
- `apps/worker/` — 异步 Worker (任务编排)
- `services/` — 独立数据服务 (data-center, data-collector)
- `packages/` — Python 量化引擎 (strategy-runtime, backtest-engine, factor-lab, ai-engine, strategies, data-client, obsidian-sync, loop-engine)
- `scripts/ralph/` — Ralph 自治开发编排 (PRD-driven story execution)
- `.skills/ralph-harness/` — Ralph harness 工程规范 (PRD 生成、反模式、收敛检测)

## 技术栈

- 前端: React + TypeScript + Vite
- 后端: Node.js + Express
- 包管理: pnpm
- 构建: Turbo
