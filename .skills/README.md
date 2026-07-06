# 项目 Skills

本目录存放 QuantForge 项目的专属 AI 编码技能（Skills），不绑定任何特定 IDE 或编码助手工具。

## 目录结构

```
.skills/
├── README.md                         ← 本文件
└── <skill-name>/
    └── SKILL.md                      ← 技能定义（YAML frontmatter + Markdown）
```

## Skill 格式

每个 skill 是一个子目录，包含一个 `SKILL.md` 文件：

```markdown
---
name: 'skill-name'
description: '一句话描述：做什么 + 何时触发'
---

# Skill 标题

详细指令...
```

## 当前已有 Skills

| 名称                        | 用途                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `quantforge-code-review`    | 量化领域专属审查：策略安全、回测配置、架构边界合规。**通用代码审查请用系统 `/code-review`**         |
| `ralph-harness`             | Ralph 自治循环 harness 工程规范：结构化错误记录、跨迭代反馈、收敛检测                               |
| `fix-python-encoding`       | 修复 Windows 中文环境下 Python 子进程 pipe 输出编码乱码（GBK → UTF-8）                              |
| `quantforge-error-patterns` | QuantForge 历史高频错误速查：lint/build/test、跨包类型、diagnostics/SSE、pnpm、Drizzle、AI/因子边界 |

## 跨工具使用

本目录的 Skill 文件采用纯 Markdown + YAML frontmatter 格式，任何 AI 编码工具均可读取。**本目录（`.skills/`）是所有 skill 的唯一真源**，纳入 git 版本控制，团队共享。

具体加载方式取决于各工具配置：

- 将 `.skills/` 目录加入工具的"自定义 prompt 目录"或"工作区规则目录"
- 或通过工具的 skill 导入功能指向本目录

### Trae 薄包装指针

Trae 的 Skill 工具按约定只扫描 `.trae/skills/` 目录自动发现 skill，而 `.trae/` 整体被 `.gitignore` 标记为 IDE-local 不入库。为了让 Trae Skill 工具能自动发现本目录的 4 个项目专属 skill，在 `.trae/skills/` 下为每个 skill 建了**薄包装**：

```
.trae/skills/<name>/SKILL.md   ← 薄包装（IDE-local、不入库）
  ├─ frontmatter 照抄真源的 name + description（触发词一致）
  └─ 正文只做一件事：要求 AI 立即 Read `.skills/<name>/SKILL.md` 并遵循其指令

.skills/<name>/SKILL.md        ← 真源（入库、团队共享、跨工具）
```

**两者不是重复内容**：薄包装是指针，真源唯一。修改 skill 内容时只改 `.skills/` 下的真源；新增 skill 时在两边各建一份（真源 + 薄包装），薄包装的 `name`/`description` 必须与真源完全一致。

真源内容不依赖任何 IDE 专属目录（如 `.codebuddy/`、`.cursor/`），`.trae/skills/` 下的薄包装仅为 Trae 自动发现而存在。
