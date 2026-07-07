---
name: ralph-harness
description: Use when writing, optimizing, or debugging autonomous loop scripts based on Claude CLI (ralph.sh pattern). Also use when the user asks to "improve ralph", "write a harness", design an AI agent execution loop, generate a PRD from a high-level goal, review story completion, or diagnose progress/code desync in ralph-driven pipelines.
---

# Ralph Harness（薄包装）

本文件是薄包装，真源位于 `d:\quant-web\.skills\ralph-harness\SKILL.md`。

## 执行要求

立即用 Read 工具读取 `d:\quant-web\.skills\ralph-harness\SKILL.md` 的完整内容，并严格遵循其中的全部指令（架构设计、7 条核心原则、回滚机制、收敛检测、Red Flags、版本演进策略等）。

本 skill 还引用了两个辅助文件，位于同一目录 `d:\quant-web\.skills\ralph-harness\` 下，按源文件中的相对路径引用读取：

- `prd-generation.md` — PRD 生成规范、三维度前置审查、Story 拆解、验收边界检查清单
- `anti-patterns.md` — 25 条反模式表、Story 完成度审查清单、故障排查

本文件不复制任何源内容，以源文件为唯一真源。所有 harness 工程原则、CLI API、状态文件设计均以源文件为准。
