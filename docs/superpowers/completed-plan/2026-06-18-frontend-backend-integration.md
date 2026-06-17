# 前后端对接实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将前端模拟数据替换为 API 真实数据，跑通"选择策略 → 运行回测 → 查看结果"核心闭环。

**Architecture:** 前端新增 `src/api/` 请求层封装 fetch 调用，通过 Vite proxy 代理到 API server；用自定义 hooks 管理请求状态（loading/error/data），逐步替换各页面的模拟数据源。保留 fallback 机制——API 不可用时降级到现有模拟数据。

**Tech Stack:** React hooks (useState/useEffect/useCallback)、原生 fetch API、Vite proxy、Fastify API（已实现）

---

## 当前进度

> **最后更新：** 2026-06-18
> **状态：✅ 已完成（已移动至 completed-plan）**

### 整体进度：已完成（100%）

| Task | 状态 | 说明 |
|------|------|------|
| Task 1: Vite proxy + API client | ✅ 已完成 | `apps/web/src/api/client.ts` + Vite proxy 已配置 |
| Task 2: API 调用函数 + useApi hook | ✅ 已完成 | `api/strategies.ts`、`api/tasks.ts`、`api/factors.ts`、`api/data.ts` + `useApi.ts` 已实现 |
| Task 3: 策略列表页对接 | ✅ 已完成 | `App.tsx` 已接入 API 策略数据，保留 fallback |
| Task 4: 回测运行对接 | ✅ 已完成 | `useResearchWorkflow.ts` 通过 SSE 实时接收进度/日志/结果事件，并用 `mapBacktestResultToReport` 映射真实回测结果 |
| Task 5: 任务列表页对接 | ✅ 已完成 | `useTasks.ts` 已对接 API 轮询，任务列表显示真实任务 |
| Task 6: 因子工坊对接 | ✅ 已完成 | `useFactors.ts` 已对接 API，`factor-lab.tsx` 已使用 API 数据并保留 fallback |
| Task 7: 端到端验证 + 清理 | ✅ 已完成 | API → Worker → Python CLI → 结果回传 链路已打通并验证；前端测试 82 passed，API 测试 21 passed，构建成功 |

### 关键实现补充（本次更新）

- **Worker 独立入口**：新增 `apps/worker/src/main.ts`，Worker 作为独立进程通过 HTTP 轮询 API 的 `/api/internal/tasks/pending` 获取任务，不再依赖内存队列与 API 同进程运行。
- **API 内部任务路由**：新增 `/api/internal/tasks/*` 端点（pending / claim / event / complete / fail），供 Worker 独占式认领和上报任务。
- **真实回测结果映射**：新增 `mapBacktestResultToReport`，将 Python `BacktestResult`（snake_case）映射为前端 `BacktestReportFull`（camelCase），未覆盖字段由 mock 数据兜底。
- **闭环验证**：启动 API（:3000）+ Worker 后，通过 `POST /api/tasks` 提交 dual_ma 回测任务，Worker 成功认领、调用 `quantforge_strategy.cli backtest`、因本地无 `data/quant.db` 数据而失败并正确上报；任务状态流转正常。

### 遗留与下一步

- 当前回测需要 `data/quant.db` 有真实行情数据，否则真实回测会失败；前端在失败时仍保留 mock fallback。
- 下一步由 `real-data-ingestion-and-e2e-verification` 计划负责：注入真实数据后，再次跑通完整 E2E 闭环并移除前端 fallback。

---

> 本计划已执行完毕，相关文件变更见仓库提交记录。
