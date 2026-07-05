# Agent 与循环引擎计划

> 合并自 06-25 三个子计划：Agent 包装层、单次闭环打通、自治 Agent 循环
>
> **状态（2026-06-28）**：A. Agent 包装层 ✅ 已完成（`apps/worker/src/agents/` base/python-agent/backtest-agent/index 已落地）；C. 自治 Agent 循环 ✅ 已完成（`scripts/ralph/` ralph-core.mjs/ralph.ps1/ralph.sh，详见 [ralph-harness-design](../../specs/2026-06-25-ralph-harness-design.md)）；**B. 单次闭环打通 🔴 未完成** — LoopHandler 迭代循环仍是骨架，是本计划唯一剩余工作。

---

## A. Agent 包装层

**Goal:** 为 Worker 中现有模块构建统一的 AgentExecutor 接口。

**Architecture:** 在 `apps/worker/src/agents/` 下创建 Agent 抽象层，每个 Agent 包装一个现有 Handler。

**Tech Stack:** TypeScript, TaskHandler/PythonBridge

### Task 清单

- **Task 1: Agent 接口** — Create `agents/base.ts`，定义 AgentType/AgentRequest/AgentResponse/AgentExecutor
- **Task 2: PythonAgent** — Create `agents/python-agent.ts`，包装 PythonBridge，支持 call/streamCall
- **Task 3: BacktestAgent** — Create `agents/backtest-agent.ts`，参数转换 + PythonAgent 执行
- **Task 4: 工厂函数** — Create `agents/index.ts`，createBacktestAgent/createPythonAgent
- **Task 5: LoopHandler 适配** — Modify `handlers/loop-handler.ts`，注入 AgentExecutor
- **Task 6: 全量测试**

---

## B. 单次闭环打通

**Goal:** 让 LoopHandler 真正执行多次迭代，打通前端→Worker→backtest→结果的端到端闭环。

**Architecture:** 新增 TypeScript 条件评估器（镜像 Python loop-engine 纯函数），LoopHandler 通过 AgentExecutor 执行迭代，检查终止条件。前端添加循环任务提交入口。

**Tech Stack:** TypeScript, vitest, AgentExecutor

### Task 清单

- **Task 1: 条件评估器** — Create `apps/worker/src/conditions.ts`，4 个条件类（MaxIterations/ConvergenceCheck/DrawdownStop/NoImprovementStop）+ evaluateConditions
- **Task 2: LoopHandler 迭代执行** — Modify `handlers/loop-handler.ts`，for 循环 → AgentExecutor → evaluateConditions → break
- **Task 3: 注册 Loop 类型** — Modify api/worker types + main.ts
- **Task 4: 前端入口** — Modify `tasks.ts` + 新建 LoopTaskForm.tsx
- **Task 5: 端到端验证**

### 架构图

```
前端 LoopTaskForm → POST /api/tasks { type: 'loop' }
  → Worker LoopHandler
    → for each: AgentExecutor → PythonBridge → Python CLI
    → evaluateConditions → if stopped → break
  → SSE progress → 前端实时显示
→ 返回 LoopResult { iterations, summary, bestResult }
```

---

## C. 自治 Agent 循环系统（Ralph 模式）

**Goal:** 参考 Ralph 模式，出门后 AI 自动拆任务、执行、检查、提交。

**Architecture:** 在 `scripts/ralph/` 下创建循环脚本、任务清单、进度日志和 AI 指令模板。每轮启动全新 Claude Code 实例，通过文件传递记忆。

**Tech Stack:** Bash, Claude Code CLI, jq, Git

### 核心机制

1. `ralph.sh` 反复启动新 AI 实例（每轮上下文干净）
2. 读取 `prd.json` + `progress.txt` + `AGENT_PROMPT.md`
3. 完成一个故事 → 检查 → 提交 → 更新 prd.json → 下一轮
4. 全部完成 → `<promise>COMPLETE</promise>` → 退出

### 文件结构

| 文件                             | 职责                               |
| -------------------------------- | ---------------------------------- |
| `scripts/ralph/ralph.sh`         | 循环脚本                           |
| `scripts/ralph/prd.json.example` | 示例格式                           |
| `scripts/ralph/AGENT_PROMPT.md`  | AI 指令模板（引用 AGENTS.md 规则） |
| `.github/workflows/ralph.yml`    | GitHub Actions workflow            |

### Task 清单

- **Task 1:** 创建 ralph.sh（`--tool claude [max_iterations]`）
- **Task 2:** 创建 AGENT_PROMPT.md（任务流程/质量检查/提交规范/停止条件）
- **Task 3:** 创建 prd.json.example（feature/branchName/userStories[]）
- **Task 4:** 创建 GitHub Actions workflow（workflow_dispatch 触发）
- **Task 5:** .gitignore 规则

### 使用方式

**本地：** `./scripts/ralph/ralph.sh --tool claude 20`（Git Bash）
**远程：** `gh workflow run ralph -f max_iterations=20`（需 ANTHROPIC_API_KEY secret）
