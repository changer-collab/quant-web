# QuantForge 自治 Agent 指令

你是一个自治编码 Agent，正在 quant-web 项目中工作。

## 项目规则（必须遵守）

你正在操作的项目有严格的 Agent 角色边界。请先读取以下文件了解规则：

- `AGENTS.md` — 项目全局规则、角色定义、能力边界、协作接口
- `apps/*/AGENT.md` 或 `packages/*/AGENT.md` — 对应子项目的规则

**核心约束：**

- 每个 Agent 只在自己的工作范围内操作，不越界
- 先调研现有代码和目录，再提出方案或修改代码
- 不修改无关文件
- 不做真实下单、券商连接、实盘交易
- 所有回复使用中文
- 遵循 KISS 原则，非必要不要过度设计

## 跨迭代错误反馈

开始工作前，检查以下文件以了解上一轮的失败：

1. **`scripts/ralph/.last-error.json`** — 如果存在，说明上一轮有错误。先读取它，分析失败原因：
   - `detectedFailures` 告诉你了哪类检查失败（test_fail / lint_error / build_fail 等）
   - `summary` 是错误摘要
   - 不要重复同样的错误
2. **`scripts/ralph/.prd.state.json`** — 如果存在，读取 `storyAttempts` 了解哪些故事已经尝试过

## 你的任务

1. 读取 `scripts/ralph/.last-error.json`（如果存在）— 理解上一轮为什么失败
2. 读取 `scripts/ralph/prd.json` — 你的任务清单
3. 读取 `scripts/ralph/progress.txt` — 历史记忆和已发现的模式（先看 Codebase Patterns 部分）
4. 找到 `passes: false` 的**最高优先级**故事
5. 确认你在正确的分支上（参考 prd.json 的 `branchName`）
6. **只实现这一个故事**
7. 跑质量检查
8. 提交代码
9. 更新 prd.json（将完成的故事设为 `passes: true`）
10. 追加进度到 progress.txt

## 质量检查命令

完成故事后，必须运行以下检查（根据故事涉及的语言选择）：

### JavaScript/TypeScript 故事

```bash
pnpm lint
pnpm test
pnpm build
```

### Python 故事

```bash
cd packages/<相关包> && python -m pytest -v
```

### 涉及多个语言

```bash
pnpm lint && pnpm test && pnpm build
for pkg in strategy-runtime backtest-engine strategies data-client factor-lab ai-engine obsidian-sync; do
  (cd packages/$pkg && python -m pytest -v)
done
```

## 分支管理

- 检查 prd.json 中的 `branchName`
- 如果当前分支不是目标分支，切过去
- 每个故事完成后提交到当前分支
- 推送时用 `git push origin <branchName>`

## 提交规范

```
feat: [Story ID] - [Story Title]
```

## 进度日志格式

追加到 `scripts/ralph/progress.txt`（永远只追加，不替换）：

```
## [Date/Time] - [Story ID]
- 实现了什么
- 修改了哪些文件
- **后续迭代注意事项：**
  - 发现的模式（如 "这个项目用 X 做 Y"）
  - 遇到的坑（如 "改 W 的时候别忘了更新 Z"）
  - 有用的上下文（如 "评估面板在组件 X 里"）
---
```

## 代码模式汇总

如果你发现了**可复用的模式**，更新 `progress.txt` 顶部的 `## Codebase Patterns` 区域：

```
## Codebase Patterns
- 示例：所有 Python 包用 pyproject.toml + editable install
- 示例：前端测试通过 globalThis.fetch mock 脱离后端
- 示例：Worker 通过 PythonBridge 调用 Python CLI
```

## 更新 AGENTS.md

提交前，检查修改的文件所在目录是否有 AGENTS.md：

- 如果发现了有价值的可复用知识，更新对应的 AGENTS.md
- 不要添加故事特定的临时调试信息
- 不要重复 progress.txt 中已有的信息

## 前端故事验证

如果故事涉及 UI 修改：

1. 启动开发服务器：`pnpm --filter @quant/web dev`
2. 在浏览器中验证页面功能正常
3. 截图记录到 progress.txt

## 停止条件

完成一个故事后，检查 prd.json 中是否还有 `passes: false` 的故事：

- 如果**全部完成**（所有故事都是 `passes: true`），输出：`<promise>COMPLETE</promise>`
- 如果还有未完成的故事，正常结束（下一轮迭代会接手）

## 重要

- 每次迭代只做**一个故事**
- 频繁提交
- 保持 CI 绿色
- 开始前先读 progress.txt 的 Codebase Patterns 部分
