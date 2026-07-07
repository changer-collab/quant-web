---
alwaysApply: false
description: 当用户说"commit"、"push"、"提交代码"、"帮我 commit"、"帮我 push"等含义相近的指令时自动激活。
---
# Commit/Push 工作流规则

## 触发条件

当用户说"commit"、"push"、"提交代码"、"帮我 commit"、"帮我 push"等含义相近的指令时自动激活。

## 工作流

> **阶段提示**：`#### [commit-push] Phase N: <步骤名>`

### 1. 确认目标仓库
- 检查当前修改了哪些仓库的文件（通过 git status）
- 如果只涉及一个仓库，直接进入步骤2
- 如果涉及多个仓库，逐个执行步骤2-5

### 2. 整理修改记录
- 读取当前仓库根目录的 `changelog-pending.md`
- 如果文件为空或不存在，根据 `git diff` 和 `git status` 手动整理修改内容
- 如果文件有内容，整理其中的零散记录

### 3. 写入 CHANGELOG.md
- 在当前仓库的 `CHANGELOG.md` 顶部追加新条目
- 格式：
  ```
  ## [分支名] YYYY-MM-DD — 简短描述
  **开发者**: 用户名

  ### 类型标签
  - 修改内容1
  - 修改内容2

  ---
  ```
- 类型标签：新增 / 修复 / 改进 / 重构 / 文档

### 4. 清空临时文件
- 将当前仓库 `changelog-pending.md` 重置为初始内容（"（暂无待提交的修改）"）

### 5. 执行 Git 操作

#### 如果用户说"commit"：
1. `git add` 具体修改的文件（避免 `git add .` 可能包含敏感文件）
2. `git commit` 并推送（commit message 用中文，简述改了什么）
3. 完成后告知用户 commit 信息

#### 如果用户说"push"：
1. 先执行 commit 流程（如果还没 commit）
2. `git push`
3. 完成后告知用户推送结果

#### 如果用户说"commit 并 push"：
1. 先 commit
2. 再 push
3. 一次性告知结果

## 约束
- **不要** `git add .`，要 add 具体文件
- **不要** push --force，除非用户明确要求
- **不要** push 到 main/master 的 --force
- **不要** commit 包含 .env、credentials 等敏感文件的修改
- commit message 用中文
- 如果仓库有未提交的修改但不涉及 CHANGELOG 变更，仍然要按流程整理并写入
