# CHANGELOG

## [ralph/backend-sync-realign-phase6-9] 2026-07-06 — 补充 .skills 跨工具说明与 Trae 薄包装指针机制
**开发者**: Codex

### 文档
- `.skills/README.md` "跨工具使用"一节重构：明确 `.skills/` 为 skill 唯一真源（入库、团队共享、跨工具），新增"Trae 薄包装指针"小节说明 `.trae/skills/<name>/` 下薄包装的设计边界与新增 skill 时的同步规则
- 新建 4 个薄包装 SKILL.md（`.trae/skills/` 下，IDE-local 不入库）：quantforge-code-review、ralph-harness、quantforge-error-patterns、fix-python-encoding；frontmatter 照抄真源 `name`/`description` 保持触发词一致，正文要求 AI 立即 Read `.skills/<name>/SKILL.md` 真源并遵循其指令

---
