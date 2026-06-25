---
name: "ralph-harness"
description: "Ralph 自治循环 harness 工程最佳实践指南。当需要编写、优化、调试基于 Claude CLI 的自治循环脚本（ralph.sh 类模式）时调用。覆盖结构化错误记录、跨迭代反馈、收敛检测、PRD 驱动任务编排、PRD 生成。"
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

---

## 核心原则

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

### 4. 状态文件设计

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
  "feature": "real-backtest-report"
}
```

### 5. PRD 生命周期与引擎绑定

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

### 6. progress.txt 追加规则

- ✅ 永远追加（`appendFileSync` / `>>`）
- ❌ 永远不要覆盖（`>`）— 分支切换时也只追加分隔线

### 7. 并行执行与隔离（高级）

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

```json
"acceptanceCriteria": [
  "BacktestResult 新增 drawdownCurve 字段",
  "report-mapper 移除所有 as any 强转",
  "pnpm --filter @quant/api test 通过",
  "pnpm build 通过"
]
```

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

### 未来方向

- **并发 worktree**：多个 Agent 在隔离的 worktree 中并行执行不同 story
- **动态任务重排**：根据 iteration 结果动态调整 story 优先级
- **LLM 驱动的错误分析**：用 LLM 分析错误日志，自动生成修复提示
- **分布式运行**：多机器、多 session 协调
- **回滚支持**：story 失败时自动回滚代码修改

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

## 参考

- [snarktank/ralph](https://github.com/snarktank/ralph) — 原始 ralph 项目
- [Anthropic Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code/cli-usage) — `--dangerously-skip-permissions` 文档
- [Reflexion](https://arxiv.org/abs/2303.11366) — Agent 自我反思与迭代改进论文
- [SWE-bench](https://www.swebench.com/) — 自治编码 Agent 基准测试
