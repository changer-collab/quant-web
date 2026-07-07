---
alwaysApply: false
description: 当用户请求修改 d:\quant-web\ 下任何文件时自动激活,包括代码、配置、文档、样式文件。
---
# quant-web-workflow Rules — QuantForge 项目主流程

## 优先级

本 rules 为项目最高优先级，高于 Superpowers rules（`.trae/rules/superpowers.md`）。
当两者冲突时，以本 rules 为准。Superpowers skills 按自身描述自动触发，本工作流不手动指定调用关系。

## 触发条件

当用户请求修改 `d:\quant-web\` 下任何文件时自动激活，包括代码、配置、文档、样式文件。
不触发：纯概念咨询、闲聊、不涉及文件修改的问答。

## 工作流

> **阶段提示要求**：执行每个步骤时，必须先输出四级标题格式的阶段提示，完成后简述本步骤结果（1-3 句话）。让开发者能清楚看到工作流进度，避免"静默执行"。格式：
>
> `#### [quant-web-workflow] Phase N: <步骤名>`

### 1. 上下文加载
- 读取项目根 `d:\quant-web\README.md` 和 `d:\quant-web\AGENTS.md`
- 读取目标模块的 `AGENT.md`（如 `apps/web/AGENT.md`、`packages/backtest-engine/AGENT.md`），如果存在
- 读取 `c:\Users\37588\.trae-cn\memory\projects\-d-quant-web\project_memory.md`（若文件不存在则跳过，不凭空生成）
- 所有约束从这些文件动态获取，本 rules 不硬编码任何项目约束
- **完成后简述**：列出本次读取了哪些文件（如 `AGENTS.md`、`apps/web/AGENT.md`、`project_memory.md`），让开发者确认上下文加载是否完整

### 2. 需求确认
- **小任务**（bug 修复、样式调整、改文案、改配置）：直接执行，执行后说明
- **中任务**（新增组件、接口）：1-3 句话说方案后执行
- **大任务**（新增页面、跨模块、跨包）：输出完整方案，**必须用 AskUserQuestion 工具确认**（选项："确认执行"、"需要调整方案"、"取消任务"），禁止让用户直接回复文字确认

### 3. 编码
- 增量修改，禁止全量重写
- 先读后改，复用现有组件和工具
- 关键逻辑注释"为什么"
- 禁止 any，用 unknown
- 新增代码前先搜索相似实现
- 严格遵守 `AGENTS.md` 的角色边界、类型归属原则和依赖白名单
- Skills 按描述自动触发（如 TDD、systematic-debugging 等），工作流不干预
- 遇到没有合适 skill 的复杂问题：
  → AI 自行完成
  → 记录到 `d:\quant-web\.trae\skill-requests.md`
  → 告知开发者："这个问题建议引入 XXX 类型的 skill，已记录到技能缺口日志"

### 4. 跨模块类型契约检查
- 如果修改了 `AGENTS.md`「类型归属原则」中列出的类型（如 TimeFrame、Bar、BacktestConfig、FactorDefinition、LoopConfig 等）：
  → 询问开发者："这个类型修改，依赖白名单里的下游模块是否也需要同步？"
  → 如果需要：按依赖白名单（`apps/* → services/data-center`、`packages/backtest-engine → packages/strategy-runtime` 等）同步下游模块
- 如果修改了跨包接口（TS ↔ Python 的 PythonBridge 协议、API ↔ Worker 的任务端点）：
  → 检查契约两端是否一致
- 如果是纯单模块内部修改（不涉及对外接口）：跳过

### 5. 验证
- 类型检查：TS 项目 `npx tsc --noEmit`，Python 项目对应类型检查
- 运行验证：启动服务、截图、curl 测试等
- 必须有实际命令输出或截图作为证据，不能只说"应该没问题"

### 6. 文档维护
检查并更新**所有**记录当前模块功能的文件：
- `README.md` — 项目概述、架构、功能列表
- `AGENTS.md` / 各模块 `AGENT.md` — AI 开发指南、约束、模块划分
- `project_memory.md` — 硬约束、经验教训（位于 memory 目录）
- 其他功能文档（如 API 文档、设计文档）
- 如果新增了组件/页面/接口/路由，必须更新对应文档
- **完成后列出清单**（必须执行，不可跳过）：
  - ✅ 已检查：列出本次检查了哪些文档文件
  - ✏️ 已更新：列出本次实际更新了哪些文档（及更新原因）
  - ⏭️ 未更新：列出未更新的文档及原因（如"本次修改不涉及 README 记录的功能"）
  - 如果本次修改涉及新功能/接口/组件但未更新对应文档，**禁止进入下一步**

### 7. 用户验收
- **先总结**：总结本次所有修改内容（改了哪些文件、做了什么、解决什么问题）
- **再用 AskUserQuestion 工具询问**：通过 AskUserQuestion 弹出询问窗口，让用户选择修改效果
  - 选项示例："满足需求"、"需要改进"、"问题未解决"
  - 如果用户选择"需要改进"，追问具体改进点
- 最多 3 轮修改循环
- 每轮告知当前是第几轮

### 8. 技能缺口记录（贯穿全流程）
- 任何时候 AI 觉得"如果有 XXX skill 会更好"
- 记录到 `d:\quant-web\.trae\skill-requests.md`（格式：日期、场景、建议类型、描述、开发者、优先级）
- 告知开发者

### 9. 修改记录（贯穿全流程）
- 每次修改文件时自动追加记录到 `d:\quant-web\.trae\changelog-pending.md`
- 当开发者说"commit"或"push"时：由 `commit-push-workflow.md` 规则接管，本规则不再处理
- 目的：方便所有团队成员查看其他人做了哪些修改

## 速查

| 模块 | 路径 |
|------|------|
| 项目根 | `d:\quant-web` |
| 前端 | `d:\quant-web\apps\web` |
| API | `d:\quant-web\apps\api` |
| Worker | `d:\quant-web\apps\worker` |
| 数据中心 | `d:\quant-web\services\data-center` |
| 数据采集器 | `d:\quant-web\services\data-collector` |
| 回测引擎 | `d:\quant-web\packages\backtest-engine` |
| AI 引擎 | `d:\quant-web\packages\ai-engine` |
| 策略运行时 | `d:\quant-web\packages\strategy-runtime` |
| 因子工坊 | `d:\quant-web\packages\factor-lab` |
| 策略库 | `d:\quant-web\packages\strategies` |
| 循环引擎 | `d:\quant-web\packages\loop-engine` |
| 项目硬约束 | `d:\quant-web\AGENTS.md` |
| 项目记忆 | `c:\Users\37588\.trae-cn\memory\projects\-d-quant-web\project_memory.md`（若存在） |
| 技能缺口日志 | `d:\quant-web\.trae\skill-requests.md` |
| 修改记录（临时） | `d:\quant-web\.trae\changelog-pending.md` |
