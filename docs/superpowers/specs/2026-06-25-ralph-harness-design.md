# Ralph Harness 工程改进设计文档

**日期**: 2026-06-25
**主题**: 自治 AI Agent 循环脚本的 Harness Engineering 改进

## 1. 背景

`scripts/ralph/ralph.sh` 是 QuantForge 项目的自治 AI Agent 循环脚本，基于 [snarktank/ralph](https://github.com/snarktank/ralph) 实现。它读取 `prd.json` 中的 user stories，通过 `claude --dangerously-skip-permissions --print` 逐轮执行，直到所有故事完成或达到最大迭代次数。

## 2. 问题分析

### 2.1 核心缺陷：错误不会被记录和迭代

**当前流程**：

```
ralph.sh 循环:
  OUTPUT=$(cat "$PROMPT_FILE" | claude ... 2>&1) || true
  # ↑ stderr 被合并，退出码被吞掉
  # → 下一轮迭代完全不知道上一轮为什么失败
```

- `2>&1` 把 stderr 合并到 stdout
- `|| true` 吞掉所有退出码
- 没有结构化错误记录
- 下一轮 Claude 从零开始，可能重复同样的错误

### 2.2 其他缺陷

| 缺陷 | 影响 |
|------|------|
| progress.txt 分支切换时被 `>` 覆盖 | 丢失历史记忆 |
| 无收敛检测 | 可能在同一问题上无限循环 |
| 无单个 story 尝试次数限制 | 一个 story 可能耗尽所有迭代 |
| `--print` 单轮无状态 | Claude 无法在执行中根据结果调整 |

## 3. 设计方案

### 3.1 结构化错误记录

**新增** `.last-error.json`：

```json
{
  "iteration": 3,
  "exitCode": 1,
  "timestamp": "2026-06-25T10:30:00+08:00",
  "detectedFailures": ["test_fail", "lint_error"],
  "summary": "test_backtest.py::test_dual_ma FAILED; ESLint: unused variable"
}
```

**错误检测函数**：从 Claude 输出中 grep 不同类型的失败（vitest、pytest、lint、TypeScript、build、git），分类记录。

### 3.2 跨迭代错误反馈

**增强 Prompt**：在发送给 Claude 之前，拼接上一轮的错误信息：

```bash
{
  cat "$PROMPT_FILE"
  echo "---"
  echo "## 上一轮状态（自动注入）"
  if [ "$LAST_ERROR" != "null" ]; then
    echo "上一轮有错误，请先分析失败原因再行动："
    cat "$ERROR_FILE"
  fi
} | claude --dangerously-skip-permissions --print
```

**关键指令**："先分析错误，再行动"——让 Claude 在开始实现之前先理解上一轮的失败。

### 3.3 状态文件 `.prd.state.json`

```json
{
  "iterations": 0,
  "lastExitCode": 0,
  "lastError": { ... },
  "storyAttempts": {
    "story-1": { "attempts": 3 },
    "story-2": { "attempts": 1 }
  },
  "lastChanges": "3 files changed, +120 -45",
  "consecutiveNoProgress": 0
}
```

### 3.4 收敛检测

两层保护：

1. **连续无进展计数**：如果连续 5 轮没有 story 从 `passes: false` 变为 `passes: true`，退出
2. **单个 story 尝试次数**：每个 story 最多尝试 5 次，超限后跳过

### 3.5 progress.txt 追加规则

分支切换时**永远追加**（`>>`），不覆盖（`>`）。

## 4. 改进文件清单

| 文件 | 变更 |
|------|------|
| `scripts/ralph/ralph-core.mjs` | **新增** — Node.js 核心模块，状态管理/错误检测/收敛判断/PRD 解析 |
| `scripts/ralph/ralph.ps1` | **新增** — PowerShell 包装层，仅循环 + 调用 claude |
| `scripts/ralph/ralph.sh` | **重写** — 简化为 Bash 包装层，仅循环 + 调用 core 模块 |
| `scripts/ralph/AGENT_PROMPT.md` | 添加错误反馈读取指令 |
| `.skills/ralph-harness/SKILL.md` | 更新为 Shell-Agnostic 架构文档 |

## 5. 架构对比：v2（Bash脚本） vs v3（核心+双包装）

| 维度 | v2（ralph-v2.sh） | v3（ralph-core.mjs + .ps1/.sh） |
|------|------------------|-------------------------------|
| **核心语言** | Bash | Node.js (ESM) |
| **Shell 依赖** | 强（bash 语法） | 弱（包装层各 ~50 行） |
| **Windows 原生** | 不支持 | 支持（PowerShell） |
| **单元测试** | 不可测 | 可作为 ESM import 测试 |
| **错误检测** | grep + sed | JS 正则（跨平台一致） |
| **JSON 处理** | inline node -e | 原生 JSON.parse/stringify |
| **状态序列化** | shell 变量拼接 | 结构化对象 |

## 6. 验证方式

1. 故意在 `prd.json` 中设置一个会失败的故事
2. 运行 `ralph-v2.sh`，观察：
   - `.last-error.json` 是否正确记录错误
   - 下一轮 Claude 是否读取并分析了错误
   - `progress.txt` 是否包含错误摘要
3. 验证收敛检测：连续 5 轮无进展后是否自动退出
4. 验证分支切换：progress.txt 是否保留历史

## 6. 验证方式

1. 故意在 `prd.json` 中设置一个会失败的故事
2. 运行 `./ralph.ps1`（PowerShell）或 `./ralph.sh`（Bash），观察：
   - `.last-error.json` 是否正确记录错误
   - 下一轮 Claude 是否读取并分析了错误
   - `progress.txt` 是否包含错误摘要
3. 验证收敛检测：连续 5 轮无进展后是否自动退出
4. 验证分支切换：progress.txt 是否保留历史

## 7. 已知限制

- `claude --print` 是单轮模式，无法在执行中动态调整——错误恢复完全依赖外层循环
- 状态文件（`.prd.state.json`）在并发场景下可能有竞争条件——当前设计假设单实例运行
- 错误检测基于 JS 正则模式匹配，可能有误报或漏报，需根据实际输出持续调优
- 核心模块同时支持 ESM import 和 CLI 调用，需注意 `import.meta.url` 的 Node.js 版本兼容性
