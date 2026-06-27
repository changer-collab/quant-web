---
name: ralph-harness
description: "Ralph 自治循环 harness 工程最佳实践指南。当需要编写、优化、调试基于 Claude CLI 的自治循环脚本（ralph.sh 类模式）时调用。覆盖结构化错误记录、跨迭代反馈、收敛检测、PRD 驱动任务编排、PRD 生成、Story 完成度审查。"
---
# Ralph Harness Engineering

基于 Claude CLI 的自治 Agent 循环脚本的 harness 工程规范。

## 触发条件

以下任一场景调用本 skill：

- 编写或优化 `scripts/ralph/` 下的循环脚本
- 用户要求"优化 ralph.sh"、"改进自治循环"、"写一个 harness"
- 需要为 AI Agent 设计自动化执行循环
- 调试 ralph 循环中的错误恢复/迭代收敛问题
- 用户提供高层目标，需要拆解为 `prd.json` 并生成可执行的 stories
- 需要审查已完成 Story 的代码完成度
- 需要排查 story 执行进度与代码实际变更不一致的问题

## 架构设计：Shell-Agnostic 分层

```
ralph-core.mjs  ← 核心逻辑（状态管理、错误检测、收敛判断、PRD 解析）
  ↕ CLI 接口（node ralph-core.mjs --xxx）
  ├── ralph-run.mjs  ← 流式执行层（stream-json 模式，实时输出 claude 文本与工具调用指示器）
  ├── ralph.sh       ← Bash 包装（仅循环 + 调用 claude）
  └── ralph.ps1      ← PowerShell 包装（仅循环 + 调用 claude）
```

所有业务逻辑在 `ralph-core.mjs` 中实现，Shell 包装只负责循环和调用 claude。

| 环境                       | 命令            | 说明       |
| -------------------------- | --------------- | ---------- |
| PowerShell（Windows 默认） | `./ralph.ps1` | 原生，推荐 |
| Git Bash / Linux / macOS   | `./ralph.sh`  | 跨平台兼容 |

### 核心模块 CLI API

所有功能通过 `node ralph-core.mjs --<command> [args]` 调用：

| 命令                    | 参数                         | 说明                                              |
| ----------------------- | ---------------------------- | ------------------------------------------------- |
| `--init`              | 无                           | 初始化 `.prd.state.json`（首次运行）            |
| `--init-run`          | 无                           | 检查 feature 是否改变，改变则重置状态并归档旧 run |
| `--remaining`         | 无                           | 输出剩余 story 数                                 |
| `--archive`           | 无                           | 分支改变时归档                                    |
| `--check-convergence` | maxFailures                  | 检测是否需要退出（exit 3）                        |
| `--check-limits`      | maxAttempts                  | 检测 story 是否超限（exit 9）                     |
| `--build-prompt`      | iteration                    | 生成增强后的 AGENT_PROMPT（stdout）               |
| `--record-error`      | iteration exitCode           | 记录错误到 `.last-error.json`                   |
| `--update-progress`   | before after                 | 更新进度计数器                                    |
| `--record-changes`    | 无                           | 记录 git diff                                     |
| `--mark-complete`     | 无                           | 完成标记                                          |
| `--append-log`        | iteration exitCode remaining | 追加 progress.txt                                 |
| `--record-ledger`     | iteration exitCode story     | 追加 error 到 error-ledger.jsonl 台账            |
| `--check-ledger`      | 无                           | 检测 ≥3 次的 pattern，输出 upgrade-proposal.json |
| `--record-changelog`  | iteration story reason files | 追加结构化改动日志到 changelog.jsonl              |
| `--rollback`          | iteration                   | 回滚到指定 iteration                              |
| `--baseline-init`     | 无                           | 打 git tag + 存基线测试结果                       |
| `--check-regression`  | iteration story             | 对比当前测试 vs 基线，退步则回滚 diff 文件        |

---

## 核心原则

Harness Engineering 遵循 6 条核心原则：

| # | 原则 | 核心要求 |
|---|------|---------|
| 1 | **有真实信号才动** | 有未完成 story 或待分析错误才启动迭代，无事直接退出 |
| 2 | **优先只加不改** | 能新增文件/函数就不改现有代码，改前必须说明理由（写入 AGENT_PROMPT） |
| 3 | **改完不退步，退步回滚** | 基线测试对比，退步则 `git checkout` 回滚 diff 文件，重试 3 次后跳过 |
| 4 | **多维度评估** | 三维度前置审查 + 验收边界检查清单，不信单个指标 |
| 5 | **一切可回滚，留改动日志** | 结构化日志（changelog.jsonl）+ 按 iteration 粒度一键回滚 |
| 6 | **单案例进台账，攒够升规则** | error-ledger.jsonl 累计，≥3 次输出升级建议给人审 |

### 1. 结构化错误记录（必须）

`ralph-core.mjs` 的 `detectFailures()` 使用正则分类检测 6 种失败类型：

```javascript
const FAILURE_PATTERNS = [
  { type: "vitest_fail",       pattern: /Tests?\s+.*failed|FAIL|×\s*.*test/i },
  { type: "pytest_fail",       pattern: /FAILED|failed\s+.*test|pytest.*error/i },
  { type: "lint_error",        pattern: /ESLint|lint.*error|error.*rule/i },
  { type: "typescript_error",  pattern: /TS\d+.*error|TypeScript\s+error/i },
  { type: "build_fail",        pattern: /Build\s+failed|build.*error|Error\s+compiling/i },
  { type: "git_error",         pattern: /fatal:|error:.*merge|could\s+not\s+apply/i },
];
```

输出写入 `.last-error.json`，包含 `iteration` / `exitCode` / `detectedFailures` / `summary`。

### 2. 跨迭代错误反馈（必须）

`ralph-core.mjs` 的 `buildEnhancedPrompt()` 自动拼接上一轮错误：

```javascript
export function buildEnhancedPrompt(iteration) {
  const prompt = readFileSync(FILES.prompt, "utf-8");
  const error = readJson(FILES.error);
  let enhanced = prompt + "\n\n---\n\n";
  enhanced += "## 上一轮运行状态（由 Ralph Core 自动注入）\n\n";
  if (error) {
    enhanced += "- 上一轮有错误，请先分析失败原因再行动。\n\n";
    enhanced += "```json\n" + JSON.stringify(error, null, 2) + "\n```\n";
  }
  return enhanced;
}
```

**关键**：告诉 Claude "先分析错误，再行动"，而不是"重新开始"。

### 3. 收敛检测（必须）

```javascript
// 连续无进展计数
export function updateProgress(remainingBefore, remainingAfter) {
  if (remainingAfter < remainingBefore) {
    state.consecutiveNoProgress = 0;
  } else {
    state.consecutiveNoProgress++;
  }
}

export function checkConvergence(maxFailures) {
  if (noProgress >= maxFailures) {
    return { shouldStop: true, reason: "..." };
  }
}
```

单个 story 尝试次数限制：每个 story 最多 5 次，超限后跳过。

### 4. 回归基线检测（必须）

每个 engine run 启动时记录基线，每次 story 修改后对比：

```javascript
// 基线生命周期
engine start
  → git tag ralph/baseline-<feature>/<timestamp>      // 快照锚点
  → pnpm test > .baseline-test-results.json            // 基线测试结果
  
story modified
  → pnpm test                                          // 当前测试
  → diff .baseline-test-results.json vs 当前结果       // 对比 exit code
  → 如果退步 → git checkout -- <diff-files>           // 回滚改动文件
  → 记录到 progress.txt                                // 结构化回滚日志
  → 重试（最多 3 次，都退步则跳过）
```

**回滚机制：**
- 只回滚当前 story 改动产生的文件（即 `git diff --name-only` 的列表）
- 不回滚上下游依赖——后续 story 可以修复依赖问题
- 退步记录在 progress.txt，格式：`[rollback] <story-id> — N files reverted — <failure-summary>`
- 同一 story 最多重试 3 次，均退步则标记为 `skip` 并跳过

### 5. 状态文件设计

```json
{
  "version": 1,
  "iterations": 0,
  "lastExitCode": 0,
  "lastError": { ... },
  "storyAttempts": {
    "story-1": { "attempts": 3 },
    "story-2": { "attempts": 1 }
  },
  "lastChanges": "3 files changed, +120 -45",
  "consecutiveNoProgress": 0,
  "feature": "real-backtest-report",
  "baselineCommit": "abc123def456",
  "baselineTag": "ralph/baseline-real-backtest-report/2026-06-26T10-00-00Z",
  "rollbackCount": 0,
  "skippedStories": []
}
```

**新增字段说明：**
- `baselineCommit` — engine run 启动时的 HEAD commit，用于退步检测对比基准
- `baselineTag` — 对应的 git tag 名，格式 `ralph/baseline-<feature>/<timestamp>`
- `rollbackCount` — 当前 run 的总回滚次数
- `skippedStories` — 因多次退步被跳过的 story 列表

### 6. PRD 生命周期与引擎绑定

每个 engine run 对应一个 feature，由 `prd.json` 的 `feature` 字段标识：

```
Feature A（回测报告）          Feature B（因子工坊）
┌──────────────┐             ┌──────────────┐
│ prd.json v1  │──engine──→  │ prd.json v2  │
│ feature:     │  完成归档    │ feature:     │
│ "回测报告"   │             │ "因子工坊"   │
│ .state.json  │             │ .state.json  │
└──────┬───────┘             └──────┬───────┘
       ▼                           ▼
   archive/                    archive/
   2026-06-25-回测报告/         2026-06-28-因子工坊/
```

- `initRun()` 检测 `prd.feature` 与 `.state.json.feature` 是否一致
- 不一致 → 自动归档当前状态 → 重置为新 feature
- 一致 → 保留状态继续迭代（同一 feature 的续跑）
- `loadPrdWithRuntime()` 在 Prompt 中注入 `_runtime`（attempts / lastError）和 `_engine`（iteration / feature）给 Claude 参考，不写回 prd.json

### 7. progress.txt 追加规则

- ✅ 永远追加（`appendFileSync` / `>>`）
- ❌ 永远不要覆盖（`>`）— 分支切换时也只追加分隔线

### 8. 真实信号守卫（必须）

Engine run 启动时，先判断本轮是否需要执行：

```javascript
export function shouldRun(state, prd) {
  const remaining = prd.userStories.filter(s => !s.passes).length;
  if (remaining === 0) {
    return { shouldRun: false, reason: "All stories complete." };
  }
  // 有待分析错误：上一轮有错误且无成功的后续 iteration
  const hasPendingError = state.lastError &&
    (state.iterations <= (state.lastError?.iteration || 0));
  if (hasPendingError) {
    return { shouldRun: true, reason: "有未修复的错误待处理" };
  }
  return { shouldRun: true, reason: "" };
}
```

**原则：仅在以下两种情况启动迭代**
1. **有未完成的 story** — `prd.json` 中存在 `passes: false` 的故事
2. **有待分析的错误** — 上一轮 iteration 出错了，需要 Agent 分析修复

无以上信号 → 自动退出，不启动 Claude CLI。

### 9. 结构化改动日志（必须）

每次 story 完成后，记录结构化日志，而非 raw diff：

```json
{
  "timestamp": "2026-06-26T10:30:00Z",
  "iteration": 5,
  "story": "story-3",
  "action": "modify",
  "filesChanged": ["apps/web/src/components/ReportMetrics.tsx"],
  "summary": "修复 null 指针导致的渲染崩溃",
  "reason": "BacktestReport 的 sortinoRatio 字段可能为 null，toFixed() 调用前需 guard"
}
```

追加到 `scripts/ralph/changelog.jsonl`，每行一条。

### 10. 一键回滚（必须有）

```bash
node ralph-core.mjs --rollback <iteration>
```

- 基于 iteration 粒度回滚
- 实现方式：通过 `git log` 定位该 iteration 对应 commit 的范围 → `git revert` 或 `git checkout`
- 回滚操作本身也记录到 changelog.jsonl

### 11. Error Ledger 台账与自动升级建议（必须有）

**台账文件：** `scripts/ralph/error-ledger.jsonl`（JSONL，每行一条）

```jsonl
{"timestamp":"2026-06-26T10:00:00Z","iteration":5,"pattern":"ts-error-strictNullChecks","story":"story-3","file":"apps/web/src/components/ReportMetrics.tsx","message":"Object is possibly 'null'","count":1}
```

**阈值检测（`checkLedger`）：** 每次 harness 完成时调用，扫描台账中 pattern 出现次数 ≥3 的条目：

```javascript
export function checkLedger() {
  const ledger = readLedger();
  const patternCounts = {};
  for (const entry of ledger) {
    patternCounts[entry.pattern] = (patternCounts[entry.pattern] || 0) + 1;
  }
  const frequent = Object.entries(patternCounts)
    .filter(([_, count]) => count >= 3)
    .map(([pattern]) => pattern);
  return frequent;
}
```

**输出升级建议（不自动写入 SKILL.md）：**

```json
{
  "generatedAt": "2026-06-26T10:30:00Z",
  "feature": "real-backtest-report",
  "highFrequencyPatterns": [
    {
      "pattern": "ts-error-strictNullChecks",
      "occurrences": 3,
      "suggestedAction": "在 tsconfig.json 中单独关闭此文件的 strictNullChecks，或统一加类型守卫",
      "suggestedUpdate": "SKILL.md 反模式表 / AGENT_PROMPT.md"
    }
  ]
}
```

写入 `scripts/ralph/upgrade-proposal.json`。

**终端提示：** 写入后，在 console 输出一行醒目提示。

**样例如下：**

```
📋 检测到 2 个高频失败模式（≥3 次出现），请审阅并考虑更新 SKILL.md：
   1. ts-error-strictNullChecks（3 次）→ scripts/ralph/upgrade-proposal.json
   2. vitest_timeout（4 次）→ scripts/ralph/upgrade-proposal.json
```

### 12. 并行执行与隔离（高级）

```bash
claude --dangerously-skip-permissions --print \
  --worktree "$WORKTREE_PATH" \
  < "$PROMPT_FILE"
```

---

## PRD 生成规范

用户提供高层目标后，按以下规范生成 `scripts/ralph/prd.json`。

### 工作流程

```
用户目标
  → 读 AGENTS.md（项目规则、角色边界、依赖白名单）
  → 读相关子项目的 AGENT.md
  → 浏览代码库，理解当前实现状态
  → 三维度前置审查（见下文）
  → 拆解为 user stories
  → 写入 scripts/ralph/prd.json
  → 输出给用户确认
  → 确认后跑引擎
```

### 三维度前置审查（PRD 生成前必须执行）

在拆解 user stories 之前，必须从三个维度审查代码库，识别所有阻塞点。**跳过此步骤会导致 PRD 遗漏关键问题，引擎反复迭代却无法收敛。**

#### 维度 1：数据源完备性 — 后端是否产出所有必要字段

**目的**：确认数据生产者（Python 引擎 / API mapper）能产出报告所需的全部字段。

**方法**：

1. 读取数据源类型定义（Python dataclass / TS interface），列出所有输出字段
2. 读取报告类型定义（`BacktestReportFull`），列出所有需要的字段
3. 制作对照表：哪些字段有数据源、哪些缺失、哪些需要计算

**常见陷阱**：

- Python 引擎只计算了基础 metrics（6 个），但报告框架需要 30+ 个指标（Sortino、Calmar、VaR、CVaR、波动率等）
- 衍生统计（drawdownCurve、monthlyReturns）在 CLI 入口附加，但 Python dataclass 本身不包含
- 字段命名不一致：Python 用 `return_pct`，TS 类型用 `return`，前端用 `return_pct`

**输出格式**：

```
| 报告字段 | 数据源 | 状态 |
|---------|--------|------|
| equityCurve | Python runner | ✅ 已有 |
| sortinoRatio | — | ❌ 缺失，需新增计算 |
| var95 | — | ❌ 缺失，需新增计算 |
```

#### 维度 2：前端渲染安全性 — 组件能否正确处理空/null 数据

**目的**：确认所有报告组件在数据为空/null/0 时不会崩溃或显示乱码。

**方法**：

1. 逐个读取报告组件（`apps/web/src/components/report/Report*.tsx`）
2. 检查每个组件对 null/empty/0 的处理方式
3. 标记三类问题：
   - 🔴 **崩溃**：null 值导致运行时异常（如 `null.toFixed()`）
   - 🟡 **乱码**：显示 "null 天"、"0.0%" 等误导性文本
   - 🟢 **安全**：有 guard 检查，空数据时不渲染或显示占位符

**常见陷阱**：

- 模板字符串 `${null} 天` 直接渲染为 "null 天"
- `null * 100` 在 JS 中为 `0`，显示 "0.0%" 但实际无数据
- ECharts 接收空数组 `[]` 时不崩溃但渲染空白图表
- 雷达图/子弹图在多维度为 0 时塌缩为一个点

**输出格式**：

```
| 组件 | 问题字段 | 严重性 | 修复方式 |
|------|---------|--------|---------|
| ReportRiskMetrics | maxDrawdownDuration | 🔴 null 天 | mapper 填默认值 或 前端 guard |
| ReportReturnMetrics | alpha | 🟡 显示 0.0% | 前端判断 null 时不显示 |
```

#### 维度 3：数据链路完整性 — 字段能否端到端流通

**目的**：确认数据从 Python → Worker → API → DB → 前端的每个 handoff 都不丢字段。

**方法**：

1. 追踪数据流：Python `_result_to_dict()` → Worker `BacktestHandler.handle()` → API `taskRoutes` → `report-mapper` → DB `reportData` → API `GET /reports/:id` → 前端 `fetchReport()`
2. 在每个 handoff 点检查：
   - 字段是否被重命名（snake_case → camelCase、`return_pct` → `return`）
   - 字段是否被 `as any` 强转后丢失类型安全
   - JSON 序列化/反序列化是否保留嵌套对象
   - `reportData` text 列是否能容纳完整报告（无截断风险）

**常见陷阱**：

- API `BacktestReportFull` 和 Web `BacktestReportFull` 是两套完全不同的接口定义
- `report-mapper.ts` 输出的字段名与 Web 类型不匹配（`drawdownSeries` vs `drawdownCurve`）
- `as any` 强转隐藏了类型错误，运行时才暴露
- 前端 `factories.ts` 的 mapper 和 API 的 mapper 是两套独立实现，字段映射不一致

**输出格式**：

```
| Handoff 点 | 问题 | 影响 |
|-----------|------|------|
| API mapper → DB | drawdownSeries 应为 drawdownCurve | 前端读取时字段名不匹配 |
| DB → 前端 | API 和 Web 的 BacktestReportFull 类型定义不同 | 前端强转可能崩溃 |
```

### Story 粒度

- **一个 story 只改一个关注点**：一个类型、一个 API 端点、一个映射逻辑、一个组件
- **一个 story 应该在一轮迭代内完成**：如果需要改 5+ 个文件，拆得更细
- **最后一个 story 应该是端到端验收**：不改代码，只验证整条链路

### 拆解顺序

```
类型/接口定义 → 核心实现 → 集成点 → 映射/适配 → 验收验证
```

常见模式：

1. 先补类型定义（Python 类型 / TS 类型）
2. 再实现核心逻辑
3. 然后连通集成点（API 路由 / CLI 命令 / Worker handler）
4. 接着统一映射层（report-mapper / 数据转换）
5. 最后端到端验证（启动服务、跑一遍流程、确认数据一致）

### 每个 Story 必须包含

| 字段                   | 要求                                                |
| ---------------------- | --------------------------------------------------- |
| `id`                 | `story-N`，从 1 开始递增                          |
| `title`              | 一句话概括（中文）                                  |
| `description`        | 说清楚：当前问题是什么、改哪个文件、改成什么        |
| `acceptanceCriteria` | 可验证的检查项，必须包含质量检查命令的结果          |
| `agent`              | 根据涉及的子项目分配角色（参考 AGENTS.md 角色定义） |
| `priority`           | 1=最先做，数字越大越后做                            |
| `dependsOn`          | 依赖哪些 story 的 id（形成 DAG）                    |

### acceptanceCriteria 编写规范

- **具体**：不要写"功能正常"，要写"GET /api/factors 返回 JSON 数组"
- **可验证**：每个标准对应一个具体的命令或检查方法
- **包含测试命令**：最后 1-2 条必须是质量检查通过
- **验收维度必须覆盖类型结构一致性**：当涉及上下游类型对齐时（如 API ↔ 前端 `BacktestReportFull`），验收标准必须包含"两端的类型定义字段名、嵌套结构完全一致"的检查，而不是只验证数值字段非空
- **验收维度必须覆盖最终渲染观察点**：当涉及前端展示时，验收标准必须描述具体的渲染结果（如"概览页展示策略名称、标的、时间范围"），而非抽象的"数据正确显示"

```json
"acceptanceCriteria": [
  "BacktestResult 新增 drawdownCurve 字段",
  "report-mapper 移除所有 as any 强转",
  "API BacktestReportFull 与前端 types.ts 的所有字段名和嵌套结构一致",
  "pnpm --filter @quant/api test 通过",
  "pnpm build 通过"
]
```

### 验收 Story 编写规范（必须）

验收 story（最后一个 story，agent 设为 `fullstack-agent`）**必须包含**以下两个层级的验证，缺一不可：

#### 层级 1：数据链路验证（CI 可自动化）
- API 返回的数据结构是否与前端类型完全对齐
- 数值指标是否满足业务预期（如"回撤 > 0"而非"非空"）
- 中文内容在前端是否正确渲染（无乱码）

#### 层级 2：UI 渲染验证（需手动或截图对比）
- 核心模块是否有数据而非空白
- 各卡片/图表是否有实际内容
- 控制台是否有 JS/TS 错误

```json
{
  "id": "story-6",
  "title": "端到端验收",
  "acceptanceCriteria": [
    "curl GET /api/reports/:id 返回的 reportData 结构和 apps/web/src/data/types.ts BacktestReportFull 完全一致",
    "风险指标卡片 sortinoRatio/calmarRatio 为非零值（正值或负值均可，但非 0 非 null）",
    "策略概览模块展示 strategies/标的/timeRange 等字段（非空）",
    "前端报告页面无空白区块",
    "控制台无 TypeScript 类型错误"
  ]
}
```

### 验收边界检查清单（新增）

每次编写或审核 PRD 时，用此清单检查验收标准是否全面：

| # | 检查项 | 问题示例 | 正确做法 |
|---|--------|---------|---------|
| 1 | **类型结构完整性** | "验证 reportData 包含 drawdownCurve（非空数组）" | "验证 reportData.equityData.drawdownCurve 为 { timestamp, drawdown }[] 且长度 > 0" |
| 2 | **嵌套对象对齐** | 只验证顶层字段 | 检查 overview/dataParams/executiveSummary 等子对象字段名是否与消费端一致 |
| 3 | **数值语义正确性** | "验证 sortinoRatio > 0"（策略亏损时 sortinoRatio 为负） | "验证 sortinoRatio 非 null 非 undefined，允许负值" |
| 4 | **空数据上游归因** | 前端空白 → 就修前端 | 先检查 API 返回是否包含数据，再检查 mapper 是否映射，再决定修哪层 |
| 5 | **中文渲染验证** | 只测 API JSON 中的值 | 需在前端实际渲染页面中观察中文是否乱码 |
| 6 | **前端 runtime 错误** | 不检查控制台 | 验收标准中必须包含"控制台无 JS/TS 错误" |
| 7 | **mock 数据 vs 真实数据** | 测试用模拟数据通过但真实数据失败 | 验收 story 必须用真实启动的服务 + 真实回测数据验证 |
| 8 | **Obsidian Builder 完整性** | builder 只验证旧 6 个指标存在 | 验收标准必须包含所有新指标（sortinoRatio/calmarRatio/annualizedVolatility 等）在 builder 输出的 markdown 中出现 |
| 9 | **跨资源类型对齐** | 只验证 JSON 结构 | 对实现 story 还需验证 `sync_backtest.py` 的 `_dict_to_backtest_result()` 和新 builder 之间的字段映射一致 |
| 10 | **SSE error 隔离** | 不做失败跳转测试 | 验收必须提交一个失败回测验证前端不跳转、状态正确 |

### 故障横向排查原则

当发现验收失败时，按以下顺序排查而非直接猜测修复：

1. **API 返回了什么？** → `curl GET /api/reports/:id` 检查原始 JSON
2. **数据结构是否对齐？** → 对比 API `BacktestReportFull` 和前端 `BacktestReportFull` 的类型定义
3. **前端请求是否正确？** → 浏览器 Network 面板看实际返回的数据
4. **组件渲染了什么？** → 检查组件读取的字段名与 API 返回的字段名是否匹配
5. **根源在哪层？** → 数据源 → 映射 → 存储 → API → 前端渲染，逐层排查

### Agent 分配规则

根据 story 修改的代码位置分配：

| 修改位置                       | agent                  |
| ------------------------------ | ---------------------- |
| `apps/api/`                  | api-agent              |
| `apps/web/`                  | frontend-agent         |
| `apps/worker/`               | worker-agent           |
| `packages/backtest-engine/`  | backtest-agent         |
| `packages/factor-lab/`       | factor-lab-agent       |
| `packages/ai-engine/`        | ai-agent               |
| `packages/strategy-runtime/` | strategy-runtime-agent |
| `packages/strategies/`       | strategies-agent       |
| `packages/data-client/`      | data-client-agent      |
| `packages/obsidian-sync/`    | obsidian-sync-agent    |
| `packages/loop-engine/`      | loop-engine-agent      |
| `services/data-center/`      | data-center-agent      |
| `services/data-collector/`   | data-collector-agent   |
| 跨多个子项目                   | fullstack-agent        |

### dependsOn 构建规则

- 被依赖的 story 必须先完成（依赖 DAG）
- 类型/接口定义 → 核心实现 → 集成 → 验收 的顺序
- 验收 story 依赖所有实现 story
- 如果两个 story 无依赖关系，不要加 dependsOn
- 检查有没有循环依赖

### branchName 命名

```
ralph/<kebab-case-feature-name>
```

从 `feature` 字段派生，全小写，用 `-` 分隔。

### 输出格式

写入 `scripts/ralph/prd.json`：

```json
{
  "feature": "feature-name",
  "branchName": "ralph/feature-name",
  "description": "一句话描述这个 feature 的目标",
  "qualityChecks": {
    "js": "pnpm lint && pnpm test && pnpm build",
    "python": "cd packages/<相关包> && python -m pytest -v"
  },
  "userStories": [
    {
      "id": "story-1",
      "title": "故事标题",
      "description": "详细的描述：当前问题 + 改动范围 + 改动方式",
      "acceptanceCriteria": [
        "具体的检查项",
        "pnpm --filter @quant/xxx test 通过"
      ],
      "agent": "xxx-agent",
      "priority": 1,
      "passes": false
    }
  ]
}
```

### 质量检查命令速查

```json
{
  "js": "pnpm lint && pnpm test && pnpm build",
  "python": "cd packages/<相关包> && python -m pytest -v",
  "multi": "pnpm lint && pnpm test && pnpm build && for pkg in strategy-runtime backtest-engine strategies data-client factor-lab ai-engine obsidian-sync; do (cd packages/$pkg && python -m pytest -v); done"
}
```

**注意**：当故事涉及 `packages/obsidian-sync` 时，必须先检查 `build_backtest_report()` 和 `_dict_to_backtest_result()` 是否完成了相应更新。质量检查命令必须加入 `cd packages/obsidian-sync && python -m pytest -v`。

### 完成后

输出后，告知用户：

1. story 数量和依赖关系
2. 预估的执行顺序（按 priority + dependsOn 拓扑排序）
3. 建议的最大迭代次数（每 story 2-3 轮）
4. 确认是否要生成

**不要自动开始跑引擎**，等用户确认后再启动。

### 禁止

- ❌ 不写无法验证的验收标准（"功能正常"是模糊的，"返回 200 且包含 X 字段"是具体的）
- ❌ 不创建超过 8 个 stories（超过说明需要拆成多个 feature）
- ❌ 不跳过 dependsOn 的拓扑验证（检查有没有循环依赖）
- ❌ 不忽略 AGENTS.md 中的角色边界（每个 story 的 agent 必须有权操作对应文件）
- ❌ 不遗漏三维度前置审查：PRD 生成前必须从数据源完备性、前端渲染安全性、数据链路完整性三个维度审查代码库。详细规范见上方"三维度前置审查"章节。
- ❌ 不遗漏 PowerShell 脚本的换行符兼容性：ralph.ps1 必须使用 CRLF（Windows 换行符），否则 PowerShell 解析会报 `UnexpectedToken` 错误。Git 自动转换可能将 CRLF 转 LF，提交前用 `sed -i 's/$/\r/'` 或 gitattributes 确保 CRLF
- ❌ **不先验锁定故障位置**：不确定故障在哪时，第一 priority 是加观测埋点收集证据，不是猜修复写进 story。没有证据链的"修复" story 大概率修错地方。正确做法是先加日志/埋点观测，确认根因后再写修复 story。
- ❌ **不跳过"先观测"阶段直接拆修复故事**：当用户说"不知道哪有问题"时，PRD 的第一个 story 必须是**加日志观测**（不修任何逻辑），跑一次确认故障位置后，再出修复 story。观测和修复必须拆成两个独立 story。
- ❌ **不把"检查点清单"写成修复步骤**：不确定位置时不要写"检查 X、检查 Y"作为修复步骤——这本质是猜 6 个可能的位置。应该写一个 story 加日志，跑完再看日志决定修哪里。
- ❌ **Story 完成后必须更新 prd.json 的 passes 字段**：Claude Agent 在每次 story 完成提交后必须写入 `"passes": true`，并确保 `description` 或其他字段的修改同时包含 `passes` 的更新。提交前检查 prd.json 的变更是否包含了 passes 状态变化。
- ❌ **验收 story 必须包含 Obsidian builder 的更新验证**：当故事要求"打通同步链路"时，必须验证 `build_backtest_report()` 和 `_dict_to_backtest_result()` 都做了相应更新，同时应检查 builder 输出的 markdown 模板中是否包含了所有新增字段。

---

## 反模式（必须避免）

| 反模式                   | 问题                                   | 正确做法                                                                                    |
| ------------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------- |
| `\|\| true` 吞掉所有错误 | 下一轮无法学习                         | `recordError()` 捕获退出码 + 分类记录                                                     |
| 每轮无状态执行           | 重复同样的错误                         | `buildEnhancedPrompt()` 注入上一轮错误摘要                                                |
| `--print` 单轮无反馈   | Agent 无法在执行中调整                 | 考虑 `--max-turns` 多轮模式                                                               |
| progress.txt `>` 覆盖  | 丢失历史记忆                           | `appendProgressLog()` 永远追加                                                            |
| 无收敛检测               | 无限循环                               | `checkConvergence()` + `checkStoryLimits()`                                             |
| 错误摘要不结构化         | 难以自动判断                           | `detectFailures()` 分 6 类检测                                                            |
| LF 换行的 ralph.ps1      | PowerShell 报 UnexpectedToken 无法运行 | 用 `sed -i 's/$/\r/'` 转换为 CRLF，或在 `.gitattributes` 中配置 `*.ps1 text eol=crlf` |
| `$ErrorActionPreference="Stop"` + native command stderr | node 写 stderr 时抛 NativeCommandError，赋值变量为 null，`.Trim()` 报 InvokeMethodOnNull | 用 `Invoke-Core` 辅助函数：`try { & node @args 2>$null } catch { return "" }`，所有 node 调用统一走此函数 |
| PowerShell 5.x 控制台默认 GBK 编码 | Claude CLI 输出 UTF-8 中文，PowerShell 5.x 控制台默认用 GBK 显示，中文全部乱码 | 在脚本顶部设置：`[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`；同时设置 `chcp 65001`（cmd 中）或 `$OutputEncoding = [System.Text.Encoding]::UTF8`（PowerShell 5.x） |
| `import.meta.url === 'file://\${process.argv[1]}'` 判断是否 CLI 直接运行 | 在 Windows 上 `import.meta.url` 用正斜杠 `file:///D:/`，`process.argv[1]` 用反斜杠 `D:\\`，条件永远 false，所有命令执行后无输出无报错 | 改为 `import.meta.url.endsWith(process.argv[1].replace(/\\\\/g, '/'))` — 先将 `argv[1]` 反斜杠统一为正斜杠再比较 |
| PowerShell `$Command \| claude --print 2>&1 \| Tee-Object` 管道阻塞 — claude 全部跑完才输出第一行 | 长时间无反馈（7+ 分钟静默），用户以为脚本卡死；无法观察 claude 正在做什么（读文件/跑测试/写代码） | 使用 `node ralph-run.mjs <prompt-file> <output-file>` 替代：启动 claude 的 `stream-json` 模式，实时解析并打印每一条 `assistant` 消息的 `text` 内容，同时用 `🔧 tool_name: detail` 显示工具调用。退出码和完整输出通过文件传递，不依赖管道。 |
| `--print` + `--output-format stream-json` 缺少 `--verbose` | Claude CLI 报错：`When using --print, --output-format=stream-json requires --verbose` | 必须同时加 `--print --verbose --output-format stream-json` 三个标志。 |
| Node `spawn("claude", [...], { shell: true })` 触发 DEP0190 | 安全性警告（shell 拼接参数有注入风险） | DEP0190 警告可安全忽略 — 所有参数均为硬编码常量，无用户输入注入风险。Windows 上 **必须** 保留 `shell: true`，因为 `.cmd` 文件需要通过 shell 解析执行，去掉会报 `spawn EINVAL`。使用 `shell: true` 时不传用户输入。 |
| Node `spawn("claude", [...])` 不加 `shell: true` 报 `spawn EINVAL` | Windows 上 `.cmd` / `.bat` 文件不可直接 spawn，报 `EINVAL`（errno -4071） | Windows 必须加 `shell: true`，因为 `.cmd` 文件在 Windows 上不是可执行二进制，必须通过 `cmd.exe` 解释执行。Unix/macOS 上的二进制文件无此限制。|
| 无基线检测直接修改代码 | 改完后引入新 bug，之前通过的测试全挂 | `--init-run` 时存基线测试结果，每个 story 后对比，退步则 `git checkout` 回滚 diff 文件 |
| 退步后继续迭代 | 同一错误反复出现，浪费迭代次数 | 回滚后同一 story 最多重试 3 次，都退步则标记 skip 跳过 |
| 改动日志只有 raw diff | 无法追溯"为什么改"，回滚时不知道影响范围 | 使用 `changelog.jsonl` 结构化日志，每条记录 timestamp/iteration/story/reason |
| error 只存最新不累计 | 无法发现重复模式，知识无法沉淀 | 追加到 `error-ledger.jsonl`，阈值 ≥3 次后输出升级建议 |
| **Claude 改代码但忘记更新 prd.json 的 passes** | prd.json 状态落后于 git log，harness 认为零进展 | ralph-core.mjs 的 `updateProgress()` 增加 git diff 和 git log 交叉验证；Agent 提交前强制检查 prd.json 是否包含 passes 变更 |
| **Story 说"打通同步链路"但只改 JSON mapper 没改 builder** | Obsidian 同步的 markdown 输出缺少新增字段 | 验收标准必须明确包含 builder 更新检查，PRD 中涉及同步管道的 story 必须列出 builder 的改动文件 |

---

## Story 完成度审查清单（2026-06-27 实战总结）

来自 `full-loop-real-data-obsidian` feature 的代码审查发现，以下是每个 story 类型的实际完成度检查项。

### 审查通用流程

```
1. 读取 prd.json，理解每个 story 的 acceptanceCriteria
2. 列出 feature 分支上所有 commit（git log oneline）
3. 为每个 story 定位对应的 commit(s)
4. 对每个 story：
   a. git show <commit> --stat 看改动文件列表
   b. 对照 acceptanceCriteria 逐条检查
   c. 检查"故事本应修改但遗漏"的文件
5. 对全链路类 story（如 story-5），检查上下游所有映射点
6. 输出完成度矩阵
```

### Story 完成度矩阵

| Story 类型 | 需要检查的文件 | 常见遗漏点 | 关键验证方法 |
|-----------|--------------|-----------|-------------|
| **Python 引擎指标扩充**（如 story-1） | `types.py`, `equity_stats.py`, `backtest.py`, 测试文件 | 新指标只加在 CLI 入口的 `_result_to_dict()`，没加在 dataclass | `git show <commit> --stat` 确认 dataclass 也新增了字段 |
| **API/前端类型对齐**（如 story-2/3） | `apps/api/src/types.ts`, `apps/api/src/mapper.ts`, `apps/web/src/data/types.ts`, `apps/web/src/data/factories.ts` | API 和前端类型定义不同步，mapper 返回 null 和返回 0 不一致 | 对比两个 types.ts 的字段名和嵌套结构，检查 mapper 对 null 的处理 |
| **前端 null 数据渲染**（如 story-4） | `apps/web/src/components/report/*.tsx`, `useResearchWorkflow.ts` | SSE error handler 没 guard，result handler 仍无条件创建 report | 读取 `useResearchWorkflow.ts` 中 error 和 result 的回调逻辑 |
| **Obsidian 同步链路**（如 story-5） | `packages/obsidian-sync/builders/backtest.py`, `strategy-runtime/commands/sync_backtest.py` | builder 没更新，`_dict_to_backtest_result()` 映射不全 | 检查两个文件是否被改过；`_dict_to_backtest_result()` 的 `BacktestMetrics(...)` 是否包含新字段 |
| **前端 UI 控件**（如 story-6） | `apps/web/src/components/workspace.tsx`, 相关 hook 中的 config 初始化 | 代码完全不存在——prd.json 说做但分支上根本没有对应的控件 | 搜索 UI 控件的关键字（如 `type="date"`）确认存在 |
| **端到端验证**（如 story-7） | 不改代码，需要手动启动服务验证 | 检查 story-7 依赖的 story 是否全部确实完成 | 启动 API + Worker + 前端，提交真实回测 |

### 关键发现（实战总结）

1. **story-1（Python 引擎指标）**：✅ 良好实现。`types.py` 的 `BacktestMetrics` 新增了 12 个指标字段，`equity_stats.py` 有完整的计算逻辑，`backtest.py` 的 `_result_to_dict` 正确序列化。

2. **story-2/3（类型对齐）**：✅ 良好实现。API `BacktestReportFull` 与前端 `types.ts` 字段名完全对齐，mapper 都用 `?? null` 处理缺失值。

3. **story-4（前端 null 渲染/SSE error）**：⚠️ 部分完成。前端组件对 null 数据有 guard（`?? 0` 或 `--` 显示），但 SSE error handler 仍允许在 error 后继续创建 report。修复方式：在 error handler 中设置 `useRef` 布尔标记，result handler 先检查该标记。

4. **story-5（Obsidian 同步）**：❌ 未完成。commit `69c6c5d` 标题说是 story-5 但内容主要是测试和环境文件，**`build_backtest_report()` 完全没有变化**，`_dict_to_backtest_result()` 只映射原始 6 个字段。

5. **story-6（数据范围选择器）**：❌ 完全未实现。`workspace.tsx` 上没有 date input。

6. **story-7（端到端验证）**：❌ 不能进行，因为 story-6 和 story-5 的 builder 未完成。

---

## 版本演进策略

### 核心原则：脚本演进 + 知识沉淀分离

```
scripts/ralph/          ← 执行层：脚本版本演进
.skills/ralph-harness/  ← 知识层：工程原则持续沉淀
```

### 文件命名与替换策略

| 阶段             | 文件布局                                                   | 说明                            |
| ---------------- | ---------------------------------------------------------- | ------------------------------- |
| **开发中** | `ralph.sh`（旧版）+ `ralph-v2.sh`（新版）              | 新旧并排，选择使用              |
| **稳定后** | `ralph-v2.sh` → 覆盖 `ralph.sh`，删除 `ralph-v2.sh` | `ralph.sh` 始终指向最新稳定版 |
| **出 v3**  | `ralph.sh`（稳定）+ `ralph-v3.sh`（开发中）            | 重复替换周期                    |

**不需要 `ralph1/ralph2/ralph3` 子文件夹。** 历史版本通过 `archive/` 统一归档。

### PowerShell 换行符兼容性（Windows 关键）

PowerShell 解析 `.ps1` 文件严格要求 **CRLF**（`\r\n`）换行符。使用 LF 换行符会报错：

```
表达式或语句中包含意外的标记"}"。
```

**修复方法**（在 Git Bash 中执行）：

```bash
sed -i 's/$/\r/' scripts/ralph/ralph.ps1
```

**预防措施**：

- 在 `.gitattributes` 中添加 `*.ps1 text eol=crlf`
- 每次创建或修改 `ralph.ps1` 后，立即用上述命令转换
- Claude 在写 `ralph.ps1` 时，Write 工具写入后立刻用 Bash 执行 CRLF 转换

### 脚本替换操作步骤

```bash
cp scripts/ralph/ralph.sh scripts/ralph/archive/$(date +%Y-%m-%d)-v2-legacy/
cp scripts/ralph/ralph-v2.sh scripts/ralph/ralph.sh
rm scripts/ralph/ralph-v2.sh
```

### 知识层同步更新

每次脚本出正式新版时，同步更新此文件：

1. 若新增了原则 → 补充到"核心原则"章节
2. 若发现了新反模式 → 追加到"反模式"表格
3. 更新"版本历史" → 追加一条记录

### 版本历史

| 版本 | 关键改进                                                               | 日期       |
| ---- | ---------------------------------------------------------------------- | ---------- |
| v1   | 基础 PRD 驱动循环                                                      | —         |
| v2   | 结构化错误记录、跨迭代反馈、收敛检测、状态文件管理                     | 2026-06-25 |
| v3   | Shell-Agnostic 架构：ralph-core.mjs 核心 + bash/PowerShell 双包装      | 2026-06-25 |
| v3.1 | PRD 生成规范合并进 skill（PLANNER_PROMPT → ralph-harness）            | 2026-06-25 |
| v3.2 | 补充 PowerShell CRLF 换行符兼容性要求 + 反模式表加 LF/CRLF 行          | 2026-06-25 |
| v3.3 | 新增"三维度前置审查"规范：数据源完备性、前端渲染安全性、数据链路完整性 | 2026-06-25 |
| v3.4 | 新增 PowerShell `$ErrorActionPreference="Stop"` + native command stderr 反模式：Invoke-Core 辅助函数模式 | 2026-06-25 |
| v3.5 | 新增 `import.meta.url` Windows 路径反斜杠兼容性反模式 + CLI 守卫修复 | 2026-06-25 |
| v3.6 | 新增 `ralph-run.mjs` 流式执行层 + stream-json 反模式：管道阻塞实时输出 | 2026-06-26 |
| v3.7 | 补充 `--print + stream-json 需要 --verbose` 反模式 + `spawn(shell:true)` DEP0190 反模式 + `spawn EINVAL` 反模式 | 2026-06-26 |
| v3.8 | 修正 `spawn EINVAL` 反模式内容：Windows 上 `.cmd` 文件**必须**用 `shell: true`，去掉会报 `EINVAL`；DEP0190 警告可安全忽略 | 2026-06-26 |
| v3.9 | 新增"故障排查"章节：`.prd.state.json` 损坏导致 prompt 为空的诊断与修复 | 2026-06-26 |
| v3.10 | 新增"验收 Story 编写规范"和"验收边界检查清单"：类型结构一致性、嵌套对象对齐、数值语义正确性、中文渲染验证 | 2026-06-26 |
| v4.0 | 新增 Harness Engineering 6 原则：真实信号守卫、回归基线检测、结构化改动日志、一键回滚、Error Ledger 台账与自动升级建议、AGENT_PROMPT 加"只加不改"指令 | 2026-06-26 |
| v4.1 | 新增"Story 完成度审查清单"章节 + 验收边界检查清单补充 Obsidian builder/SSE error 检查项 + 反模式表中补充 prd.json passes 遗忘和 builder 遗漏 | 2026-06-27 |

### 未来方向

- **并发 worktree**：多个 Agent 在隔离的 worktree 中并行执行不同 story
- **动态任务重排**：根据 iteration 结果动态调整 story 优先级
- **LLM 驱动的错误分析**：用 LLM 分析错误日志，自动生成修复提示
- **分布式运行**：多机器、多 session 协调

---

## 故障排查

### `.prd.state.json` 损坏 → prompt 为空

**症状：** ralph 启动后每轮迭代 prompt 只有 3 个字符，输出 `WARNING: Prompt is very short: "﻿\n"`，claude CLI 立即退出（exit code 0），无任何实际执行。

**根因：** `ralph-core.mjs` 的 `readJson()` 调用 `JSON.parse()` 解析 `.prd.state.json`。当文件为空（0 bytes）或内容为非法 JSON 时，`JSON.parse("")` 抛出 `SyntaxError: Unexpected end of JSON input`。`buildEnhancedPrompt()` 中调用 `readState()` 时崩溃，`--build-prompt` 无 stdout 输出，ralph.ps1 拿到空 prompt 写入 `.current-prompt.md`。

**诊断：**

```bash
# 检查文件大小
wc -c scripts/ralph/.prd.state.json
# 输出 "0 scripts/ralph/.prd.state.json" → 文件为空

# 或直接查看内容
cat scripts/ralph/.prd.state.json
# 空输出 → 确认损坏
```

**修复：**

```bash
# 1. 删除损坏文件
rm -f scripts/ralph/.prd.state.json

# 2. 重新初始化
node scripts/ralph/ralph-core.mjs --init
node scripts/ralph/ralph-core.mjs --init-run

# 3. 验证修复
node scripts/ralph/ralph-core.mjs --build-prompt 1 | wc -c
# 应输出 >10000（约 14KB）
```

**预防建议：** `readJson()` 应在 `JSON.parse` 前检查空字符串：

```javascript
function readJson(filePath) {
  if (!existsSync(filePath)) return null;
  const content = readFileSync(filePath, "utf-8").trim();
  if (!content) return null;  // 空文件当作不存在
  return JSON.parse(content);
}
```

### prd.json 进度不同步（代码改了但 passes 没更新）

**症状：** Ralph 的 Claude Agent 完成了代码修改并提交了 git commit，但 `prd.json` 的 `passes` 字段仍是 `false`。下一轮迭代时 harness 认为"零进展"，可能收敛退出或重新分配已完成的 story。

**根因（三层）：**

1. **Claude Agent 没执行第 9 步** — AGENT_PROMPT.md 要求"更新 prd.json passes"，但 Claude 可能因输出截断、工具调用出错或精力花在修复 test/lint 后忘记写入
2. **`updateProgress()` 只检查 passes 数量** — 不检查 git diff 或 git log，Claude 可以提交所有代码变更但只要 passes 没变就认为零进展
3. **混合提交污染** — 非 story 范围的 harness 基础设施文件混入 story commit，干扰了 `passes` 的正常更新

**验证：**

```bash
# 检查 feature 分支上的所有 commit
git log --oneline ralph/<branch> ^main

# 对照 prd.json 的 userStories 确认
node scripts/ralph/ralph-core.mjs --remaining

# 检查最新 commit 是否包含了 prd.json 修改
git show HEAD --name-only
git show HEAD -- scripts/ralph/prd.json  # 检查 prd.json 是否有改动
```

**修复（手动同步）：**

```bash
# 手动修改 prd.json 将已完成 story 设为 passes: true
# 然后提交
git add scripts/ralph/prd.json
git commit -m "docs: sync prd.json passes to actual code progress"
```

---

## 相关文件

- `scripts/ralph/ralph-core.mjs` — 核心逻辑（平台无关）
- `scripts/ralph/ralph-run.mjs` — 流式执行层（stream-json 模式，实时输出 claude 文本与工具调用指示器）
- `scripts/ralph/ralph.sh` — Bash 包装（Linux / Git Bash / macOS）
- `scripts/ralph/ralph.ps1` — PowerShell 包装（Windows）
- `scripts/ralph/AGENT_PROMPT.md` — Claude 执行 Agent 的系统指令
- `scripts/ralph/PLANNER_PROMPT.md` — PRD 生成指令备份（内容已合并进本 skill）
- `scripts/ralph/prd.json` — 任务清单
- `scripts/ralph/prd.json.example` — prd.json 模板示例
- `scripts/ralph/.prd.state.json` — 运行时状态（自动维护）
- `scripts/ralph/.last-error.json` — 上一轮错误详情
- `scripts/ralph/error-ledger.jsonl` — 错误台账（JSONL，每行一条，永远追加）
- `scripts/ralph/upgrade-proposal.json` — 高频错误升级建议（需人审后写入 SKILL.md）
- `scripts/ralph/changelog.jsonl` — 结构化改动日志
- `scripts/ralph/.baseline-test-results.json` — 基线测试结果快照

## 参考

- [snarktank/ralph](https://github.com/snarktank/ralph) — 原始 ralph 项目
- [Anthropic Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/cli-usage) — `--dangerously-skip-permissions` 文档
- [Reflexion](https://arxiv.org/abs/2303.11366) — Agent 自我反思与迭代改进论文
- [SWE-bench](https://www.swebench.com/) — 自治编码 Agent 基准测试
