---
name: ralph-harness
description: Use when writing, optimizing, or debugging autonomous loop scripts based on Claude CLI (ralph.sh pattern). Also use when the user asks to "improve ralph", "write a harness", design an AI agent execution loop, generate a PRD from a high-level goal, review story completion, or diagnose progress/code desync in ralph-driven pipelines.
---
# Ralph Harness Engineering

基于 Claude CLI 的自治 Agent 循环脚本的 harness 工程规范。

## When to Use

```
用户请求
  ├── 涉及 ralph 脚本？ ──── 是 ──→ USE
  ├── "优化 ralph" / "写 harness" / "自治循环"？ ──→ USE
  ├── 高层目标 → 需拆解为 PRD + stories？ ──→ USE + [prd-generation.md](prd-generation.md)
  ├── Story 完成度审查 / 进度不一致排查？ ──→ USE + [anti-patterns.md](anti-patterns.md)
  ├── 调试 ralph 错误恢复 / 收敛问题？ ──→ USE + [anti-patterns.md](anti-patterns.md)
  └── 以上皆非 ──→ 不需要本 skill
```

**When NOT to use:**
- One-off shell scripts that don't need iterative AI execution loops
- Tasks completable in a single Claude invocation without iteration
- General Claude CLI usage (use claude-api skill instead)
- The task doesn't involve `scripts/ralph/` or PRD-driven multi-turn execution

**Keywords:** ralph, harness, autonomous loop, agent loop, PRD, story, iteration, convergence, self-healing, error recovery, Claude CLI --print, multi-turn agent

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

Harness Engineering 遵循 7 条核心原则：

| # | 原则 | 核心要求 |
|---|------|---------|
| 1 | **有真实信号才动** | 有未完成 story 或待分析错误才启动迭代，无事直接退出 |
| 2 | **优先只加不改** | 能新增文件/函数就不改现有代码，改前必须说明理由（写入 AGENT_PROMPT） |
| 3 | **改完不退步，退步回滚** | 基线测试对比，退步则 `git checkout` 回滚 diff 文件，重试 3 次后跳过 |
| 4 | **多维度评估** | 三维度前置审查 + 验收边界检查清单，不信单个指标 |
| 5 | **一切可回滚，留改动日志** | 结构化日志（changelog.jsonl）+ 按 iteration 粒度一键回滚 |
| 6 | **单案例进台账，攒够升规则** | error-ledger.jsonl 累计，≥3 次输出升级建议给人审 |
| 7 | **Story 完成必须包含文档同步判断** | 每次 story 完成后必须显式判断文档是否需要同步：更新受影响文档或记录明确判断"无需更新"并写明原因。判断不可延期；"之后再补"不算有效完成。 |

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

### 6-12. 运行时机制速查

| # | 机制 | 关键实现 | 文件/命令 |
|---|------|---------|-----------|
| 6 | PRD 生命周期绑定 | `initRun()` 检测 feature 变化 → 自动归档/重置；`loadPrdWithRuntime()` 注入 `_runtime` + `_engine` 元数据 | `ralph-core.mjs` |
| 7 | progress.txt 追加 | 永远 `appendFileSync` / `>>`，永不覆盖 | `--append-log` |
| 8 | 真实信号守卫 | `shouldRun()`: 有未完成 story 或有待分析错误才启动，无事直接退出 | `ralph-core.mjs` |
| 9 | 结构化改动日志 | JSONL：`{timestamp, iteration, story, action, filesChanged, summary, reason}` | `changelog.jsonl` |
| 10 | 一键回滚 | `node ralph-core.mjs --rollback <iteration>`，通过 git log 定位 → revert/checkout | `--rollback` |
| 11 | Error Ledger 台账 | JSONL 累计 pattern，≥3 次输出 `upgrade-proposal.json`，终端醒目提示 | `error-ledger.jsonl` |
| 12 | 并行 worktree 隔离 | `claude --dangerously-skip-permissions --print --worktree "$WORKTREE_PATH"` | 高级特性 |

### Red Flags — STOP and Re-check

These thoughts mean you're about to violate a harness engineering rule:

| Thought | Reality |
|---------|---------|
| "I'll skip the three-dimension review, it's a small change" | Small changes break pipelines. The review catches blind spots. |
| "I'll update prd.json passes later" | Harness sees zero progress next iteration. Update passes in the same commit. |
| "Let me do 2-3 stories in one iteration to save time" | Context compaction loses details. One story per iteration. See [anti-patterns.md](anti-patterns.md). |
| "The tests pass, so the code is correct" | Shallow assertions miss invariants. Grep for `≈`/`sum`/`abs`/`all` in tests. |
| "No need to check convergence, one more iteration won't hurt" | Infinite loops start with "one more." Trust the convergence detector. |
| "I'll just run the engine without checking for actual signal" | Engine wastes Claude CLI invocations on no-op iterations. `shouldRun()` first. |
| "The error is probably in the frontend, let me fix it there" | Guess-driven fixes waste iterations. Add logging, observe, THEN fix. |
| "I'll update docs in a separate iteration" | Story completion without Doc Sync judgment is incomplete. Judgment must fire every iteration — deferred documentation is not accepted. |

---

## PRD 生成 & 反模式 & 故障排查

以下内容已拆分为独立参考文件，按需加载（避免每次加载 51KB 进上下文）：

- **[prd-generation.md](prd-generation.md)** — PRD 生成规范：三维度前置审查、Story 拆解、验收标准编写、Agent 分配规则、验收边界检查清单、故障横向排查
- **[anti-patterns.md](anti-patterns.md)** — 反模式表（25 条已知失败模式及修复）、Story 完成度审查清单与矩阵、故障排查（.prd.state.json 损坏、prd.json 进度不同步）、PowerShell CRLF 换行符兼容性

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

### PowerShell CRLF 兼容性

PowerShell `.ps1` 严格要求 CRLF 换行符。LF 导致 `UnexpectedToken`。修复：`sed -i 's/$/\r/' scripts/ralph/ralph.ps1`；预防：`.gitattributes` 加 `*.ps1 text eol=crlf`。详见 [anti-patterns.md](anti-patterns.md)。

### 脚本替换操作

```bash
cp scripts/ralph/ralph.sh scripts/ralph/archive/$(date +%Y-%m-%d)-v2-legacy/
cp scripts/ralph/ralph-v2.sh scripts/ralph/ralph.sh
rm scripts/ralph/ralph-v2.sh
```

### 未来方向

- **并发 worktree**：多个 Agent 在隔离的 worktree 中并行执行不同 story
- **动态任务重排**：根据 iteration 结果动态调整 story 优先级
- **LLM 驱动的错误分析**：用 LLM 分析错误日志，自动生成修复提示
- **分布式运行**：多机器、多 session 协调

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

**Related superpowers skills:**
- `superpowers:subagent-driven-development` — subagent dispatch patterns (ralph harness uses subagents for story execution)
- `superpowers:executing-plans` — plan execution methodology (aligns with PRD-driven iteration)
- `superpowers:verification-before-completion` — verification gates (aligns with story completion review)
