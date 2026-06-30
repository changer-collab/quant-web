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
name: "skill-name"
description: "一句话描述：做什么 + 何时触发"
---

# Skill 标题

详细指令...
```

## 当前已有 Skills

| 名称 | 用途 |
|------|------|
| `quantforge-code-review` | 量化领域专属审查：策略安全、回测配置、架构边界合规。**通用代码审查请用系统 `/code-review`** |
| `ralph-harness` | Ralph 自治循环 harness 工程规范：结构化错误记录、跨迭代反馈、收敛检测 |
| `fix-python-encoding` | 修复 Windows 中文环境下 Python 子进程 pipe 输出编码乱码（GBK → UTF-8）|
| `quantforge-error-patterns` | QuantForge 历史高频错误速查：lint/build/test、跨包类型、diagnostics/SSE、pnpm、Drizzle、AI/因子边界 |

## 跨工具使用

本目录的 Skill 文件采用纯 Markdown + YAML frontmatter 格式，任何 AI 编码工具均可读取。具体加载方式取决于各工具配置：

- 将 `.skills/` 目录加入工具的"自定义 prompt 目录"或"工作区规则目录"
- 或通过工具的 skill 导入功能指向本目录

不依赖任何 IDE 专属目录（如 `.trae/`、`.codebuddy/`、`.cursor/`）。
